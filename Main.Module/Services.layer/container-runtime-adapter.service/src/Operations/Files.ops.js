/*
    ARQUIVOS DENTRO DE UM VOLUME (VDRP-260) — e, em breve, dentro de um
    container (CTMG-44).

    Não existe API do Docker para ler ou escrever num volume diretamente:
    volume só é acessível de dentro de um container. `ExportVolume`
    (Volumes.ops) já resolvia isso para "leve tudo embora"; estes quatro
    métodos são o mesmo padrão para as operações que faltavam — listar,
    escrever, ler um arquivo e apagar.

    Este módulo existe separado dos volumes porque o mesmo problema tem dois
    donos: os arquivos DE UM CONTAINER, que chegam em CTMG-44, respondem com a
    mesma forma (`{ path, entries: [...] }`) e merecem ficar lado a lado, não
    espalhados por dois arquivos que nunca se olham.

    CAMINHO É SEMPRE RELATIVO À RAIZ DO VOLUME e conferido aqui, na entrada:
    qualquer ".." ou caminho absoluto é recusado ANTES de tocar no Docker. Este
    módulo é a última fronteira antes do sistema de arquivos real — a checagem
    de quem é dono do volume acontece muito antes, no Platform Manager, mas
    contenção de caminho é responsabilidade de quem executa.
*/

// TAR mínimo escrito à mão — a API do Docker só troca arquivo com container por
// TAR, e este pacote tem uma dependência declarada só (VDRP-260).
const {
    BuildTarWithSingleFile,
    ExtractFirstFileFromTar
} = require("../Helpers/TarSingleFile")
/*
    Contenção de caminho vive em Helpers/ResolveVolumeEntryPath.js — função
    pura, testável sem socket, sem imagem e sem container. Aqui só se aplica.
*/
const {
    RequireSafeVolumePath,
    RequireSafeFileName
} = require("../Helpers/ResolveVolumeEntryPath")

const CreateFileOperations = ({ StreamToBuffer, ephemeral }) => {

    const {
        CreateEphemeralVolumeContainer,
        RunEphemeralAndCollect,
        RemoveEphemeral
    } = ephemeral

    const RequireSafePath = (relativePath) => RequireSafeVolumePath(relativePath)

    /*
        Lista UM nível do diretório. A saída vem de `stat -c` (presente no
        busybox da alpine) com separador improvável em nome de arquivo, e cada
        linha é parseada aqui — nomes com espaço continuam íntegros porque o
        nome é o ÚLTIMO campo e nada é dividido depois dele.
    */
    const ListVolumeEntries = async ({ volumeName, path }) => {
        const alvo = RequireSafePath(path)
        let container
        try {
            const comando = `cd '${alvo.absolute}' 2>/dev/null || exit 3; ` +
                `find . -mindepth 1 -maxdepth 1 -exec stat -c '%F|%s|%Y|%n' {} \\; 2>/dev/null || true`

            container = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", comando], readOnly: true
            })
            const resultado = await RunEphemeralAndCollect(container)

            if (resultado.statusCode === 3) {
                const error = new Error("Caminho não encontrado dentro do espaço.")
                error.code = "PATH_NOT_FOUND"
                throw error
            }
            if (resultado.statusCode !== 0) {
                throw new Error(`Falha ao listar o conteúdo do volume (código ${resultado.statusCode}): ${resultado.stderr}`)
            }

            const entries = resultado.stdout
                .split("\n")
                .map((linha) => linha.trim())
                .filter((linha) => linha.length > 0)
                .map((linha) => {
                    const partes = linha.split("|")
                    if (partes.length < 4) return null
                    const [tipo, tamanho, modificado, ...restoDoNome] = partes
                    const nomeBruto = restoDoNome.join("|")
                    return {
                        name: nomeBruto.replace(/^\.\//, ""),
                        isDirectory: tipo.includes("directory"),
                        size: Number(tamanho) || 0,
                        modifiedAt: new Date(Number(modificado) * 1000).toISOString()
                    }
                })
                .filter((entry) => entry !== null && entry.name.length > 0)
                .sort((a, b) => (a.isDirectory === b.isDirectory)
                    ? a.name.localeCompare(b.name)
                    : (a.isDirectory ? -1 : 1))

            return { path: alvo.relative, entries }
        } catch (error) {
            console.error(`Error listing volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }
    }

    /*
        Escreve um arquivo. `putArchive` recebe um TAR e o extrai no diretório
        de destino — daí o tar de um arquivo só, construído sem biblioteca
        (ver Helpers/TarSingleFile.js).
    */
    const PutFileInVolume = async ({ volumeName, path, fileName, contentBase64 }) => {
        const destino = RequireSafePath(path)
        const nome = RequireSafeFileName(fileName)

        const conteudo = Buffer.from(contentBase64 ?? "", "base64")
        const tar = BuildTarWithSingleFile({
            name: nome,
            content: conteudo,
            mtimeSeconds: Math.floor(Date.now() / 1000)
        })

        let container
        try {
            // Garante o diretório de destino antes de extrair: putArchive falha
            // se o caminho não existir, e criar diretório é justamente o que a
            // pessoa espera ao enviar para uma pasta nova.
            container = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", `mkdir -p '${destino.absolute}'`], readOnly: false
            })
            const preparo = await RunEphemeralAndCollect(container)
            if (preparo.statusCode !== 0) {
                throw new Error(`Falha ao preparar o diretório de destino: ${preparo.stderr}`)
            }

            await container.putArchive(tar, { path: destino.absolute })

            return {
                path: destino.relative,
                name: nome,
                size: conteudo.length
            }
        } catch (error) {
            console.error(`Error writing file into volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }
    }

    const GetFileFromVolume = async ({ volumeName, path }) => {
        const alvo = RequireSafePath(path)
        if (alvo.relative === "") {
            const error = new Error("Informe o arquivo a baixar.")
            error.code = "INVALID_PATH"
            throw error
        }

        let container
        try {
            container = await CreateEphemeralVolumeContainer({ volumeName, readOnly: true })

            let stream
            try {
                stream = await container.getArchive({ path: alvo.absolute })
            } catch (archiveError) {
                const error = new Error("Arquivo não encontrado dentro do espaço.")
                error.code = "PATH_NOT_FOUND"
                error.cause = archiveError
                throw error
            }

            const tar = await StreamToBuffer(stream)
            const arquivo = ExtractFirstFileFromTar(tar)
            if (!arquivo) {
                const error = new Error("O caminho informado não é um arquivo.")
                error.code = "NOT_A_FILE"
                throw error
            }

            return {
                isBase64 : true,
                fileName : arquivo.name,
                mimeType : "application/octet-stream",
                size     : arquivo.size,
                data     : arquivo.content.toString("base64")
            }
        } catch (error) {
            console.error(`Error reading file from volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }
    }

    const DeleteVolumeEntry = async ({ volumeName, path }) => {
        const alvo = RequireSafePath(path)
        if (alvo.relative === "") {
            // Apagar a raiz seria esvaziar o espaço inteiro por um caminho
            // vazio — remoção de espaço tem caminho próprio, com confirmação.
            const error = new Error("Não é possível remover a raiz do espaço por aqui.")
            error.code = "INVALID_PATH"
            throw error
        }

        let container
        try {
            container = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", `rm -rf '${alvo.absolute}'`], readOnly: false
            })
            const resultado = await RunEphemeralAndCollect(container)
            if (resultado.statusCode !== 0) {
                throw new Error(`Falha ao remover (código ${resultado.statusCode}): ${resultado.stderr}`)
            }
            return { path: alvo.relative, removed: true }
        } catch (error) {
            console.error(`Error removing entry from volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }
    }

    return {
        ListVolumeEntries,
        PutFileInVolume,
        GetFileFromVolume,
        DeleteVolumeEntry
    }
}

module.exports = CreateFileOperations
