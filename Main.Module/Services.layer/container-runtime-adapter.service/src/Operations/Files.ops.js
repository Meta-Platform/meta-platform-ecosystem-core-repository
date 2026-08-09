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
    ExtractFirstFileFromTar,
    ReadTarEntries
} = require("../Helpers/TarSingleFile")
/*
    Contenção de caminho vive em Helpers/ResolveVolumeEntryPath.js — função
    pura, testável sem socket, sem imagem e sem container. Aqui só se aplica.
*/
const {
    RequireSafeVolumePath,
    RequireSafeFileName
} = require("../Helpers/ResolveVolumeEntryPath")

/*
    `RunExec` chega pelo contexto, vindo de Containers.ops.

    É a única dependência entre dois módulos de operações, e é deliberada:
    listar arquivo de container rodando É um exec, e reimplementá-lo aqui
    significaria manter duas decodificações de fluxo binário — que foi
    exatamente o defeito do terminal (CTMG-21).
*/
const CreateFileOperations = ({ docker, StreamToBuffer, ephemeral, RunExec }) => {

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

    /* ================================================================
       ARQUIVOS DENTRO DE UM CONTAINER (CTMG-44)

       Mesma forma de resposta das operações de volume acima — de propósito:
       a tela é a mesma, e um `{ path, entries }` diferente por origem faria
       o componente ter dois caminhos onde precisa de um.

       A REGRA DOS DOIS CAMINHOS

       Container RODANDO: dá para executar `find` e `stat` lá dentro, que é
       barato e devolve dono, permissão e data.

       Container PARADO: não há processo para executar nada. Aí a saída é
       `getArchive`, que funciona com o container desligado, e ler os
       CABEÇALHOS do tar — sem extrair o conteúdo, que pode ser gigante.

       Sem os dois caminhos, metade das perguntas ficaria sem resposta
       justamente quando mais se precisa delas: investigar um container que
       morreu é o caso em que olhar os arquivos importa mais.
       ================================================================ */

    const ContainerEstaRodando = async (containerIdOrName) => {
        const info = await docker.getContainer(containerIdOrName).inspect()
        return Boolean(info?.State?.Running)
    }

    /*
        Caminho dentro do container é absoluto e livre — ao contrário do
        volume, onde tudo é relativo à raiz montada. Aqui a contenção não faz
        sentido: quem abriu um terminal no container já pode ler `/etc/shadow`,
        e fingir uma restrição que o terminal não tem seria teatro.

        O que ainda vale é recusar o que não é caminho.
    */
    const ExigirCaminhoDeContainer = (path) => {
        if (typeof path !== "string" || path.trim() === "") {
            const erro = new Error("Informe o caminho dentro do container.")
            erro.code = "INVALID_PATH"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }
        return path.trim()
    }

    const ListContainerEntries = async ({ containerIdOrName, path = "/" }) => {
        const alvo = ExigirCaminhoDeContainer(path)

        if (await ContainerEstaRodando(containerIdOrName)) {
            return await ListarComExec(containerIdOrName, alvo)
        }
        return await ListarComArquivo(containerIdOrName, alvo)
    }

    const ListarComExec = async (containerIdOrName, alvo) => {
        const comando = `cd '${alvo}' 2>/dev/null || exit 3; ` +
            `find . -mindepth 1 -maxdepth 1 -exec stat -c '%F|%s|%Y|%a|%U|%n' {} \\; 2>/dev/null || true`

        const resultado = await RunExec({
            containerIdOrName,
            cmd: ["sh", "-c", comando],
            timeoutMs: 20000
        })

        if (resultado.exitCode === 3) {
            const erro = new Error(`Caminho não encontrado no container: ${alvo}`)
            erro.code = "PATH_NOT_FOUND"
            erro.httpStatus = 404
            erro.statusCode = 404
            throw erro
        }

        /*
            `stat` não existe em imagem distroless nem em scratch. Falhar com
            "comando não encontrado" seria inútil; o caminho do tar funciona
            para qualquer imagem, então servimos por ele.
        */
        if (resultado.exitCode !== 0 && resultado.stdout.trim() === "") {
            return await ListarComArquivo(containerIdOrName, alvo)
        }

        const entries = resultado.stdout
            .split("\n")
            .map((linha) => linha.trim())
            .filter((linha) => linha.length > 0)
            .map((linha) => {
                const partes = linha.split("|")
                if (partes.length < 6) return null
                const [tipo, tamanho, modificado, modo, dono, ...restoDoNome] = partes
                return {
                    name: restoDoNome.join("|").replace(/^\.\//, ""),
                    isDirectory: tipo.includes("directory"),
                    size: Number(tamanho) || 0,
                    modifiedAt: new Date(Number(modificado) * 1000).toISOString(),
                    mode: modo,
                    owner: dono
                }
            })
            .filter((entrada) => entrada !== null && entrada.name.length > 0)
            .sort(PorPastaDepoisNome)

        return { path: alvo, entries, source: "exec" }
    }

    const ListarComArquivo = async (containerIdOrName, alvo) => {
        let stream
        try {
            stream = await docker.getContainer(containerIdOrName).getArchive({ path: alvo })
        } catch (error) {
            const erro = new Error(`Caminho não encontrado no container: ${alvo}`)
            erro.code = "PATH_NOT_FOUND"
            erro.httpStatus = 404
            erro.statusCode = 404
            erro.cause = error
            throw erro
        }

        const tar = await StreamToBuffer(stream)
        const { entries: cabecalhos } = ReadTarEntries(tar)

        /*
            O tar de um diretório vem com o próprio diretório como primeira
            entrada e os filhos prefixados por ele. Um nível só, para casar
            com o que o exec devolve.
        */
        const raiz = cabecalhos.length > 0 ? cabecalhos[0].name.replace(/\/$/, "") : ""

        const entries = cabecalhos
            .slice(1)
            .map((entrada) => {
                const relativo = entrada.name
                    .replace(new RegExp(`^${raiz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`), "")
                    .replace(/\/$/, "")
                return { ...entrada, relativo }
            })
            .filter((entrada) => entrada.relativo !== "" && !entrada.relativo.includes("/"))
            .map((entrada) => ({
                name: entrada.relativo,
                isDirectory: entrada.isDirectory,
                size: entrada.size,
                modifiedAt: entrada.mtimeSeconds
                    ? new Date(entrada.mtimeSeconds * 1000).toISOString()
                    : null,
                mode: entrada.mode || null,
                owner: null
            }))
            .sort(PorPastaDepoisNome)

        return { path: alvo, entries, source: "archive" }
    }

    const PorPastaDepoisNome = (a, b) => (a.isDirectory === b.isDirectory)
        ? a.name.localeCompare(b.name)
        : (a.isDirectory ? -1 : 1)

    const CopyFromContainer = async ({ containerIdOrName, path }) => {
        const alvo = ExigirCaminhoDeContainer(path)

        let stream
        try {
            stream = await docker.getContainer(containerIdOrName).getArchive({ path: alvo })
        } catch (error) {
            const erro = new Error(`Arquivo não encontrado no container: ${alvo}`)
            erro.code = "PATH_NOT_FOUND"
            erro.httpStatus = 404
            erro.statusCode = 404
            erro.cause = error
            throw erro
        }

        const tar = await StreamToBuffer(stream)
        const arquivo = ExtractFirstFileFromTar(tar)

        if (!arquivo) {
            const erro = new Error("O caminho informado não é um arquivo.")
            erro.code = "NOT_A_FILE"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        return {
            isBase64: true,
            fileName: arquivo.name,
            mimeType: "application/octet-stream",
            size: arquivo.size,
            data: arquivo.content.toString("base64")
        }
    }

    const CopyToContainer = async ({ containerIdOrName, path, fileName, contentBase64 }) => {
        const destino = ExigirCaminhoDeContainer(path)
        const nome = RequireSafeFileName(fileName)

        const conteudo = Buffer.from(contentBase64 ?? "", "base64")
        const tar = BuildTarWithSingleFile({
            name: nome,
            content: conteudo,
            mtimeSeconds: Math.floor(Date.now() / 1000)
        })

        try {
            await docker.getContainer(containerIdOrName).putArchive(tar, { path: destino })
            return { path: destino, name: nome, size: conteudo.length }
        } catch (error) {
            console.error(`Error writing file into container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        Apagar e criar pasta exigem processo: `putArchive` cria arquivo, mas
        não remove nem cria diretório vazio de forma confiável. Container
        parado não tem como executar nada — e essa é uma limitação do runtime,
        não uma escolha nossa, então ela é dita com todas as letras.
    */
    const ExigirContainerRodando = async (containerIdOrName, operacao) => {
        if (await ContainerEstaRodando(containerIdOrName)) return

        const erro = new Error(
            `${operacao} exige o container em execução: sem processo não há como executar o comando. ` +
            "Suba o container e tente de novo."
        )
        erro.code = "CONTAINER_NOT_RUNNING"
        erro.httpStatus = 409
        erro.statusCode = 409
        throw erro
    }

    const DeleteContainerEntry = async ({ containerIdOrName, path }) => {
        const alvo = ExigirCaminhoDeContainer(path)

        if (alvo === "/") {
            const erro = new Error("Não é possível remover a raiz do container.")
            erro.code = "INVALID_PATH"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        await ExigirContainerRodando(containerIdOrName, "Remover arquivo")

        const resultado = await RunExec({
            containerIdOrName,
            cmd: ["sh", "-c", `rm -rf '${alvo}'`],
            timeoutMs: 20000
        })

        if (resultado.exitCode !== 0) {
            throw new Error(`Falha ao remover (código ${resultado.exitCode}): ${resultado.stderr}`)
        }

        return { path: alvo, removed: true }
    }

    const MakeContainerDirectory = async ({ containerIdOrName, path }) => {
        const alvo = ExigirCaminhoDeContainer(path)

        await ExigirContainerRodando(containerIdOrName, "Criar pasta")

        const resultado = await RunExec({
            containerIdOrName,
            cmd: ["sh", "-c", `mkdir -p '${alvo}'`],
            timeoutMs: 20000
        })

        if (resultado.exitCode !== 0) {
            throw new Error(`Falha ao criar a pasta (código ${resultado.exitCode}): ${resultado.stderr}`)
        }

        return { path: alvo, created: true }
    }

    /*
        Criar pasta dentro de um VOLUME (CTMG-86 depende disto).

        O navegador de volume não tinha como criar diretório — a única forma
        era enviar um arquivo para um caminho novo e deixar o `mkdir -p`
        implícito do Put fazer o trabalho.
    */
    const MakeVolumeDirectory = async ({ volumeName, path }) => {
        const alvo = RequireSafePath(path)

        let container
        try {
            container = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", `mkdir -p '${alvo.absolute}'`], readOnly: false
            })
            const resultado = await RunEphemeralAndCollect(container)
            if (resultado.statusCode !== 0) {
                throw new Error(`Falha ao criar a pasta (código ${resultado.statusCode}): ${resultado.stderr}`)
            }
            return { path: alvo.relative, created: true }
        } catch (error) {
            console.error(`Error creating directory in volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }
    }

    /*
        ENVIO EM PARTES (VDRP-290) — o que permite arquivo de gigabytes.

        `PutFileInVolume` recebe o arquivo inteiro num campo base64. Isso tem um
        teto DURO que não é de política: uma string de 4 GB (o base64 de um
        arquivo de 3 GB) simplesmente não existe no motor JavaScript, nem no
        navegador nem aqui. Nenhum aumento de limite resolveria.

        Aqui o arquivo chega em blocos. Cada bloco é gravado como uma parte
        numerada dentro de um diretório temporário no PRÓPRIO volume — nunca em
        memória — e a última chamada concatena as partes na ordem e renomeia
        para o nome final. A memória usada é a de um bloco, seja o arquivo de
        10 MB ou de 3 GB.

        Por que as partes ficam no volume, e não em /tmp do container efêmero:
        cada bloco roda num container novo, e o /tmp dele morre junto. O volume
        é o único lugar que sobrevive entre as chamadas.

        O nome temporário começa com ponto e carrega o nome do arquivo, então
        duas transferências simultâneas para a mesma pasta não se misturam. Se
        uma for abandonada no meio, o que fica é um diretório oculto — visível
        para quem for procurar, e removível, em vez de um arquivo pela metade
        se passando por completo.
    */
    const PutFileChunkInVolume = async ({ volumeName, path, fileName, contentBase64, partIndex, isLast }) => {
        const destino = RequireSafePath(path)
        const nome = RequireSafeFileName(fileName)

        const parteNumero = Number(partIndex)
        if (!Number.isInteger(parteNumero) || parteNumero < 0) {
            const error = new Error("partIndex precisa ser um inteiro não negativo.")
            error.code = "INVALID_PART_INDEX"
            throw error
        }

        const conteudo = Buffer.from(contentBase64 ?? "", "base64")
        const nomeDaParte = `part-${String(parteNumero).padStart(6, "0")}`

        // O diretório temporário fica ao lado do destino, no mesmo volume.
        const temporarioRelativo = destino.relative === ""
            ? `.upload-${nome}`
            : `${destino.relative}/.upload-${nome}`
        const temporario = RequireSafePath(temporarioRelativo)

        const tar = BuildTarWithSingleFile({
            name: nomeDaParte,
            content: conteudo,
            mtimeSeconds: Math.floor(Date.now() / 1000)
        })

        let container
        try {
            container = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", `mkdir -p '${temporario.absolute}'`], readOnly: false
            })
            const preparo = await RunEphemeralAndCollect(container)
            if (preparo.statusCode !== 0) {
                throw new Error(`Falha ao preparar a transferência: ${preparo.stderr}`)
            }

            await container.putArchive(tar, { path: temporario.absolute })
        } catch (error) {
            console.error(`Error writing chunk into volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }

        if (!isLast) {
            return { path: destino.relative, name: nome, partIndex: parteNumero, completed: false }
        }

        /*
            Fecho: concatena na ORDEM (o glob ordena porque os nomes são
            zero-padded), grava com o nome final e só então remove o temporário.
            A ordem importa — apagar antes de confirmar a escrita deixaria o
            usuário sem as partes e sem o arquivo.
        */
        let fechamento
        try {
            const comando =
                `set -e; ` +
                `cat '${temporario.absolute}'/part-* > '${destino.absolute}/${nome}'; ` +
                `rm -rf '${temporario.absolute}'`

            fechamento = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", comando], readOnly: false
            })
            const resultado = await RunEphemeralAndCollect(fechamento)
            if (resultado.statusCode !== 0) {
                throw new Error(`Falha ao concluir a transferência (código ${resultado.statusCode}): ${resultado.stderr}`)
            }

            return { path: destino.relative, name: nome, partIndex: parteNumero, completed: true }
        } catch (error) {
            console.error(`Error completing chunked upload into volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(fechamento)
        }
    }

    /*
        MOVER (e RENOMEAR) uma entrada dentro do volume.

        Um método só para as duas coisas porque, no sistema de arquivos, elas
        SÃO a mesma: renomear é mover para o mesmo diretório com outro nome.
        Dois métodos significariam duas validações de caminho para manter em
        sincronia, e é a validação que protege aqui.

        NÃO SOBRESCREVE. `mv` calado por cima de um arquivo existente destrói
        o que estava lá, e do outro lado da tela isso apareceria como "renomeei
        e o outro arquivo sumiu". Existindo destino, a operação é recusada com
        código próprio para a tela poder dizer o que houve.

        Os dois caminhos passam pela mesma contenção do resto do módulo: o
        conteúdo do volume é o limite, e nem origem nem destino escapam dele.
    */
    const MoveVolumeEntry = async ({ volumeName, path, destinationPath }) => {
        const origem = RequireSafePath(path)
        const destino = RequireSafePath(destinationPath)

        if (origem.relative === "") {
            const error = new Error("Não é possível mover a raiz do espaço.")
            error.code = "INVALID_PATH"
            throw error
        }
        if (destino.relative === "") {
            const error = new Error("Informe o destino.")
            error.code = "INVALID_PATH"
            throw error
        }
        if (origem.relative === destino.relative) {
            return { path: destino.relative, moved: false }
        }
        /*
            Mover uma pasta para dentro dela mesma apaga a árvore em alguns
            runtimes e cria um laço em outros. É recusado aqui, antes de o
            comando existir.
        */
        if (destino.relative.indexOf(`${origem.relative}/`) === 0) {
            const error = new Error("Não é possível mover uma pasta para dentro dela mesma.")
            error.code = "INVALID_PATH"
            throw error
        }

        let container
        try {
            const comando =
                `[ -e '${origem.absolute}' ] || exit 3; ` +
                `[ -e '${destino.absolute}' ] && exit 4; ` +
                `mkdir -p "$(dirname '${destino.absolute}')" && mv '${origem.absolute}' '${destino.absolute}'`

            container = await CreateEphemeralVolumeContainer({
                volumeName, cmd: ["sh", "-c", comando], readOnly: false
            })
            const resultado = await RunEphemeralAndCollect(container)

            if (resultado.statusCode === 3) {
                const error = new Error("O item que se quer mover não existe mais.")
                error.code = "PATH_NOT_FOUND"
                throw error
            }
            if (resultado.statusCode === 4) {
                const error = new Error("Já existe um item com esse nome no destino.")
                error.code = "DESTINATION_EXISTS"
                throw error
            }
            if (resultado.statusCode !== 0) {
                throw new Error(`Falha ao mover (código ${resultado.statusCode}): ${resultado.stderr}`)
            }

            return { path: destino.relative, moved: true }
        } catch (error) {
            console.error(`Error moving entry in volume ${volumeName}:`, error)
            throw error
        } finally {
            await RemoveEphemeral(container)
        }
    }

    return {
        ListVolumeEntries,
        PutFileInVolume,
        GetFileFromVolume,
        DeleteVolumeEntry,
        MakeVolumeDirectory,
        MoveVolumeEntry,
        PutFileChunkInVolume,
        ListContainerEntries,
        CopyToContainer,
        CopyFromContainer,
        DeleteContainerEntry,
        MakeContainerDirectory
    }
}

module.exports = CreateFileOperations
