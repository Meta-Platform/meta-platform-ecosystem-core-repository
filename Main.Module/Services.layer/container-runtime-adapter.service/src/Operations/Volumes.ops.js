/*
    Operações de VOLUME (CTMG-36).

    O volume em si — listar, inspecionar, criar, remover e exportar. O que
    acontece DENTRO dele (listar, ler, escrever, apagar arquivo) vive em
    Files.ops.js, junto com as operações equivalentes de container: são o mesmo
    problema com dois donos.
*/

const { PassThrough } = require('node:stream')

const NormalizedLabels = (labels) => {
    return Object.fromEntries(
        Object.entries(labels).map(([key, value]) => [ key, value == null ? "" : String(value) ])
    )
}

const CreateVolumeOperations = ({ docker, SafeFileName, ephemeral }) => {

    const { VOLUME_EXPORT_IMAGE, EnsureVolumeExportImage } = ephemeral

    const ListAllVolumes = async () => {
        try {
            const volumes = await docker.listVolumes()
            return volumes
        }
        catch (error) {
            console.error('Error listing volumes:', error)
            throw error
        }


    }

    const InspectVolume = async (volumeName) => {
        try {
            const volume = docker.getVolume(volumeName)
            const volumeInfo = await volume.inspect()
            return volumeInfo
        }
        catch (error) {
            console.error(`Error inspecting volume ${volumeName}:`, error)
            throw error
        }
    }

    // options no formato do Docker: { Name, Driver, DriverOpts, Labels }
    // Aceita tanto `Labels` quanto `labels` (o orquestrador envia minúsculo com
    // valores numéricos: socketId/instanceId/serviceId) e sempre normaliza para
    // string — o Docker exige Labels do tipo map[string]string.
    /*
        O NOME DO VOLUME PRECISA CHEGAR COMO `Name` (VDRP-259).

        A API do Docker nomeia o volume pelo campo `Name`; qualquer outra chave
        é ignorada e o daemon cria um volume ANÔNIMO (aquele id de 64 hex). O
        service-orchestrator sempre chamou isto com `volumeName`
        (ServiceOrchestrator.manager.js), então todo CREATE_NEW_VOLUME vinha
        criando volume anônimo — e ninguém percebia, porque o volume NOMEADO
        acabava nascendo depois, sozinho, quando o container era criado com o
        mount daquele nome.

        O espaço de dados do usuário é o primeiro volume que existe SEM
        container (VDRP-259): ele precisa estar lá antes de qualquer aplicação
        montá-lo, e é dentro dele que o MyData lê e escreve arquivos
        (VDRP-260). Com o nome perdido, o espaço "existia" no registro e não no
        Docker.

        Aceita as duas formas de propósito: `Name` (contrato do Docker, para
        quem já chama certo) e `volumeName` (como o orquestrador chama). Traduzir
        aqui conserta todos os chamadores de uma vez, sem quebrar nenhum.
    */
    const CreateNewVolume = async (options) => {
        const { Labels, labels, Name, volumeName, ...rest } = options ?? {}
        const nome = Name ?? volumeName

        try {
            const volume = await docker.createVolume({
                ...rest,
                ...(nome ? { Name: nome } : {}),
                Labels: NormalizedLabels(Labels || labels || {})
            })
            return volume
        } catch (error) {
            console.error(`Error creating volume ${nome || 'unknown'}:`, error)
            throw error
        }
    }

    const RemoveVolume = async (volumeName) => {
        try {
            const volume = docker.getVolume(volumeName)
            await volume.remove()
            return { success: true, message: `Volume ${volumeName} removed successfully` }
        } catch (error) {
            console.error(`Error removing volume ${volumeName}:`, error)
            throw error
        }
    }

    // Exporta um volume usando um container efêmero que empacota /data em tar.gz.
    // Não há API direta no Docker para volumes; montamos o volume (somente leitura)
    // num container alpine e capturamos a saída de `tar czf -` pela stdout.
    const ExportVolume = async (volumeName) => {
        let container
        try {
            // Valida a existência do volume antes de criar o container efêmero.
            await docker.getVolume(volumeName).inspect()

            await EnsureVolumeExportImage()

            container = await docker.createContainer({
                Image        : VOLUME_EXPORT_IMAGE,
                Cmd          : ["tar", "czf", "-", "-C", "/data", "."],
                Tty          : false,
                AttachStdout : true,
                AttachStderr : true,
                HostConfig   : {
                    Binds      : [`${volumeName}:/data:ro`],
                    AutoRemove : false
                }
            })

            const stream = await container.attach({ stream: true, stdout: true, stderr: true })

            const stdout = new PassThrough()
            const stderr = new PassThrough()
            const stdoutChunks = []
            const stderrChunks = []
            stdout.on("data", (chunk) => stdoutChunks.push(chunk))
            stderr.on("data", (chunk) => stderrChunks.push(chunk))

            // Saída sem TTY vem multiplexada (stdout/stderr) — demux separa os canais.
            docker.modem.demuxStream(stream, stdout, stderr)

            await container.start()
            const result = await container.wait()

            if (result && result.StatusCode !== 0) {
                const errText = Buffer.concat(stderrChunks).toString("utf-8")
                throw new Error(`Falha ao exportar volume (código ${result.StatusCode}): ${errText}`)
            }

            const buffer = Buffer.concat(stdoutChunks)
            return {
                isBase64 : true,
                fileName : `${SafeFileName(volumeName, "volume")}.tar.gz`,
                mimeType : "application/gzip",
                data     : buffer.toString("base64")
            }
        } catch (error) {
            console.error(`Error exporting volume ${volumeName}:`, error)
            throw error
        } finally {
            if (container) {
                try {
                    await container.remove({ force: true })
                } catch (cleanupError) {
                    console.error(`Error removing temporary export container:`, cleanupError)
                }
            }
        }
    }

    return {
        ListAllVolumes,
        InspectVolume,
        CreateNewVolume,
        RemoveVolume,
        ExportVolume
    }
}

module.exports = CreateVolumeOperations
