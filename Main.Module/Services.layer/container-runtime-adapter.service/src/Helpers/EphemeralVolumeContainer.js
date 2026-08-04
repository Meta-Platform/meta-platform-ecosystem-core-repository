/*
    CONTAINER EFÊMERO SOBRE UM VOLUME (VDRP-260).

    Volume nomeado não é diretório acessível de fora do runtime: para ler ou
    escrever dentro dele é preciso montá-lo em ALGUM container. Este módulo é o
    padrão que resolve isso, usado por tudo que toca o conteúdo de um volume —
    exportar o volume inteiro (Volumes.ops) e as operações de arquivo
    (Files.ops).

    Em Put/Get o container NUNCA É INICIADO: `putArchive` e `getArchive` operam
    sobre o sistema de arquivos do container criado, e nenhum processo do
    usuário chega a rodar. Em List/Delete ele roda um comando de shell da imagem
    alpine — não do usuário — e morre em seguida.

    Fábrica em vez de módulo com estado porque o `docker` varia por conexão: o
    gerenciador de conexões instancia um adaptador por perfil cadastrado.
*/

const { PassThrough } = require('node:stream')
const { VOLUME_MOUNT_PATH } = require("./ResolveVolumeEntryPath")

// Imagem leve usada para montar o volume. É a única dependência de imagem
// externa deste pacote, e por isso `EnsureVolumeExportImage` a baixa sozinho.
const VOLUME_EXPORT_IMAGE = 'alpine:latest'

const CreateEphemeralVolumeContainerFactory = ({ docker }) => {

    // Garante que a imagem esteja disponível localmente antes de qualquer uso.
    const EnsureVolumeExportImage = async () => {
        try {
            await docker.getImage(VOLUME_EXPORT_IMAGE).inspect()
            return
        } catch (error) {
            // imagem ausente — segue para o pull
        }
        await new Promise((resolve, reject) => {
            docker.pull(VOLUME_EXPORT_IMAGE, (err, stream) => {
                if (err) return reject(err)
                docker.modem.followProgress(stream, (doneErr) => doneErr ? reject(doneErr) : resolve())
            })
        })
    }

    /*
        Cria o container com o volume montado. `readOnly` existe para as
        operações de leitura: montar em modo escrita para listar seria dar mais
        acesso do que a operação precisa.
    */
    const CreateEphemeralVolumeContainer = async ({ volumeName, cmd, readOnly }) => {
        await docker.getVolume(volumeName).inspect()
        await EnsureVolumeExportImage()

        return docker.createContainer({
            Image        : VOLUME_EXPORT_IMAGE,
            Cmd          : cmd ?? ["true"],
            Tty          : false,
            AttachStdout : true,
            AttachStderr : true,
            HostConfig   : {
                Binds      : [`${volumeName}:${VOLUME_MOUNT_PATH}${readOnly ? ":ro" : ""}`],
                AutoRemove : false
            }
        })
    }

    const RunEphemeralAndCollect = async (container) => {
        const stream = await container.attach({ stream: true, stdout: true, stderr: true })

        const stdout = new PassThrough()
        const stderr = new PassThrough()
        const stdoutChunks = []
        const stderrChunks = []
        stdout.on("data", (chunk) => stdoutChunks.push(chunk))
        stderr.on("data", (chunk) => stderrChunks.push(chunk))
        docker.modem.demuxStream(stream, stdout, stderr)

        await container.start()
        const resultado = await container.wait()

        return {
            statusCode: resultado?.StatusCode ?? 0,
            stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
            stderr: Buffer.concat(stderrChunks).toString("utf-8")
        }
    }

    /*
        A remoção acontece em `finally` de quem usa. Falhar aqui não pode
        derrubar a operação que já deu certo — o container fica para trás e
        aparece como órfão na tela de manutenção (CTMG-131), que é melhor que
        perder o resultado.
    */
    const RemoveEphemeral = async (container) => {
        if (!container) return
        try {
            await container.remove({ force: true })
        } catch (cleanupError) {
            console.error("Error removing temporary volume container:", cleanupError)
        }
    }

    return {
        VOLUME_EXPORT_IMAGE,
        EnsureVolumeExportImage,
        CreateEphemeralVolumeContainer,
        RunEphemeralAndCollect,
        RemoveEphemeral
    }
}

module.exports = CreateEphemeralVolumeContainerFactory
module.exports.VOLUME_EXPORT_IMAGE = VOLUME_EXPORT_IMAGE
