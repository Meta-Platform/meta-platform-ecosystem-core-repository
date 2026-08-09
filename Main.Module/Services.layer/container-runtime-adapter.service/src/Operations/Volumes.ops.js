/*
    Operações de VOLUME (CTMG-36).

    O volume em si — listar, inspecionar, criar, remover e exportar. O que
    acontece DENTRO dele (listar, ler, escrever, apagar arquivo) vive em
    Files.ops.js, junto com as operações equivalentes de container: são o mesmo
    problema com dois donos.
*/

const { PassThrough } = require('node:stream')

const NormalizeDockerFilters = require("../Helpers/NormalizeDockerFilters")
const BuildPruneOptions = require("../Helpers/BuildPruneOptions")

const BuildFilterOption = (filters) => {
    const normalizados = NormalizeDockerFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

const NormalizedLabels = (labels) => {
    return Object.fromEntries(
        Object.entries(labels).map(([key, value]) => [ key, value == null ? "" : String(value) ])
    )
}

const CreateVolumeOperations = ({ docker, SafeFileName, ephemeral }) => {

    const { VOLUME_EXPORT_IMAGE, EnsureVolumeExportImage } = ephemeral

    /*
        Chamada sem argumento mantém o comportamento de antes (CTMG-41).
        `filters` aceita dangling, driver, label, name.
    */
    const ListAllVolumes = async ({ filters } = {}) => {
        try {
            const volumes = await docker.listVolumes(BuildFilterOption(filters))
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

    /*
        Remoção de volume, agora com `force` (CTMG-49).

        Aceita as DUAS formas: a string posicional de sempre — que o
        service-orchestrator usa, de outro repositório — e o objeto
        `{ volumeName, force }`. Trocar a assinatura sem aceitar a antiga
        quebraria o provisionamento da nuvem em silêncio, porque
        `getVolume(undefined)` não falha na hora.
    */
    const RemoveVolume = async (volumeNameOrOptions) => {
        const { volumeName, force } = typeof volumeNameOrOptions === "string"
            ? { volumeName: volumeNameOrOptions, force: false }
            : (volumeNameOrOptions ?? {})

        if (!volumeName) {
            const erro = new Error("Informe o nome do volume a remover.")
            erro.code = "INVALID_VOLUME_NAME"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        try {
            const volume = docker.getVolume(volumeName)
            await volume.remove(force ? { force: true } : {})
            return { success: true, message: `Volume ${volumeName} removed successfully` }
        } catch (error) {
            console.error(`Error removing volume ${volumeName}:`, error)
            throw error
        }
    }

    /*
        PODA DE VOLUMES (CTMG-49).

        A mais perigosa das quatro podas: volume apagado é DADO apagado, sem
        equivalente ao "baixa de novo" que salva imagem e container. Por padrão
        o daemon só remove volumes sem nenhum container associado, mas isso
        inclui o volume que alguém criou ontem para usar amanhã.

        A interface passa antes pela prévia de CTMG-129, que lista nome por
        nome. Aqui a responsabilidade é não silenciar o filtro — ver
        NormalizeDockerFilters.
    */
    const PruneVolumes = async ({ filters } = {}) => {
        try {
            const resultado = await docker.pruneVolumes(BuildPruneOptions(filters))
            return {
                VolumesDeleted: resultado?.VolumesDeleted || [],
                SpaceReclaimed: resultado?.SpaceReclaimed || 0
            }
        } catch (error) {
            console.error("Error pruning volumes:", error)
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

    /* ================================================================== E8 */

    /*
        QUEM ESTÁ USANDO ESTE VOLUME (CTMG-100).

        A pergunta que o Portainer não responde, e a reclamação mais repetida
        de quem administra volumes por interface gráfica: dá para ver que o
        volume existe, não dá para saber quem depende dele — então ninguém
        remove nada, e o disco enche.

        Container PARADO também conta. Ele volta a rodar, e o volume que
        alguém apagou "porque ninguém usava" não volta.
    */
    const ContainersUsingVolume = async (volumeName) => {
        const containers = await docker.listContainers({ all: true })

        return containers
            .filter((container) =>
                (container.Mounts || []).some((montagem) => montagem.Name === volumeName))
            .map((container) => ({
                id: container.Id,
                name: (container.Names?.[0] || "").replace(/^\//, ""),
                state: container.State,
                running: container.State === "running"
            }))
    }

    /*
        As três operações destrutivas (importar, clonar sobre existente,
        esvaziar) RECUSAM volume em uso, salvo `force`.

        O motivo é físico: escrever por baixo de um processo que já tem o
        arquivo aberto produz corrupção silenciosa — um Postgres com o
        datadir trocado sob os pés não falha na hora, falha depois.
    */
    const ExigirVolumeLivre = async (volumeName, force, operacao) => {
        if (force) return []

        const usuarios = await ContainersUsingVolume(volumeName)
        const rodando = usuarios.filter((usuario) => usuario.running)
        if (rodando.length === 0) return usuarios

        const erro = new Error(
            `Não é possível ${operacao} o volume ${volumeName}: ` +
            `${rodando.map((u) => u.name).join(", ")} ${rodando.length === 1 ? "está" : "estão"} usando. ` +
            "Escrever por baixo de um processo em execução corrompe em silêncio. " +
            "Pare o container, ou repita com force para assumir o risco."
        )
        erro.code = "VOLUME_IN_USE"
        erro.httpStatus = 409
        erro.statusCode = 409
        erro.containers = rodando
        throw erro
    }

    const GetVolumeUsage = async (volumeName) => {
        const [inspecao, usedBy] = await Promise.all([
            docker.getVolume(volumeName).inspect(),
            ContainersUsingVolume(volumeName)
        ])

        let container
        let sizeBytes = null
        let fileCount = null

        try {
            container = await ephemeral.CreateEphemeralVolumeContainer({
                volumeName,
                readOnly: true,
                /*
                    `du -sb` não existe no BusyBox do alpine (é do coreutils),
                    então o tamanho vem de `du -sk`: KiB de disco ocupado.

                    O que estava aqui antes somava o tamanho aparente com `cat`
                    de todos os arquivos — ou seja, LIA o volume inteiro byte a
                    byte para descobrir quanto ele pesa. Num volume de dezenas de
                    gigabytes (que é o caso desde que espaço de dados guarda
                    modelo 3D) isso é minutos de CPU e disco para produzir um
                    número, e é o mesmo caminho que a cota consulta antes de
                    cada envio.

                    O número muda de sentido: passa a ser o que o volume OCUPA,
                    não a soma dos tamanhos. Para cota é o número certo — é o
                    que enche o disco —, e a diferença só aparece com muitos
                    arquivos pequenos.
                */
                cmd: ["sh", "-c",
                    "du -sk /data 2>/dev/null | cut -f1; " +
                    "find /data -type f 2>/dev/null | wc -l"]
            })

            const saida = await ephemeral.RunEphemeralAndCollect(container)
            const [emKiB, arquivos] = String(saida.stdout).trim().split(/\s+/)
            // `du` responde em KiB; quem consome espera bytes.
            sizeBytes = Number(emKiB) * 1024
            fileCount = Number(arquivos)
        } catch (error) {
            // Medir é um extra: sem a medição a resposta segue com o resto, em
            // vez de a tela inteira falhar por causa de um número.
            console.error(`Error measuring volume ${volumeName}:`, error)
        } finally {
            await ephemeral.RemoveEphemeral(container)
        }

        return {
            name: volumeName,
            driver: inspecao.Driver,
            mountpoint: inspecao.Mountpoint,
            createdAt: inspecao.CreatedAt,
            labels: inspecao.Labels || {},
            sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
            fileCount: Number.isFinite(fileCount) ? fileCount : null,
            usedBy
        }
    }

    /*
        RESTAURAR UM BACKUP (CTMG-98).

        O `ExportVolume` existia sem par desde sempre: um backup que não
        restaura não é backup, é um arquivo.

        O tar.gz vai inteiro para o `putArchive`, que o Docker descomprime
        sozinho — a mesma rota do `docker cp`.
    */
    const ImportVolume = async ({ volumeName, contentBase64, clear = false, force = false }) => {
        if (!volumeName || !contentBase64) {
            const erro = new Error("Informe o volume de destino e o conteúdo do backup.")
            erro.code = "INVALID_VOLUME_IMPORT"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        // Volume que não existe é CRIADO: restaurar um backup numa máquina nova
        // é o caso mais comum, e exigir criar antes seria um passo sem motivo.
        let criado = false
        try {
            await docker.getVolume(volumeName).inspect()
        } catch (error) {
            await docker.createVolume({ Name: volumeName })
            criado = true
        }

        if (!criado) await ExigirVolumeLivre(volumeName, force, "restaurar sobre")

        if (clear) await EsvaziarConteudo(volumeName)

        let container
        try {
            container = await ephemeral.CreateEphemeralVolumeContainer({ volumeName })

            const tar = Buffer.from(contentBase64, "base64")
            const fluxo = new PassThrough()
            fluxo.end(tar)

            /*
                O container NÃO é iniciado: `putArchive` escreve no sistema de
                arquivos dele, e o bind faz isso cair dentro do volume. Nenhum
                processo do usuário chega a rodar.
            */
            await container.putArchive(fluxo, { path: "/data" })

            return { volumeName, created: criado, restored: true, sizeBytes: tar.length }
        } catch (error) {
            console.error(`Error importing volume ${volumeName}:`, error)
            throw error
        } finally {
            await ephemeral.RemoveEphemeral(container)
        }
    }

    const EsvaziarConteudo = async (volumeName) => {
        let container
        try {
            container = await ephemeral.CreateEphemeralVolumeContainer({
                volumeName,
                // Os ocultos precisam do segundo padrão; `.` e `..` ficam de fora
                // pelo `[!.]`, senão o rm tenta apagar o diretório pai.
                cmd: ["sh", "-c", "rm -rf /data/..?* /data/.[!.]* /data/* 2>/dev/null; exit 0"]
            })
            const saida = await ephemeral.RunEphemeralAndCollect(container)
            if (saida.statusCode !== 0) {
                throw new Error(`Falha ao esvaziar o volume: ${saida.stderr}`)
            }
        } finally {
            await ephemeral.RemoveEphemeral(container)
        }
    }

    const EmptyVolume = async ({ volumeName, force = false }) => {
        await ExigirVolumeLivre(volumeName, force, "esvaziar")
        await EsvaziarConteudo(volumeName)
        return { volumeName, emptied: true }
    }

    /*
        CLONAR (CTMG-99).

        Sem isto, duplicar um volume na linha de comando é a gambiarra
        conhecida: criar container temporário, montar os dois, `cp -a`, apagar
        o container. É exatamente o que acontece aqui — uma vez, testado, em
        vez de de cabeça a cada vez.

        `cp -a` e não `cp -r`: dono, permissão e data importam. Um datadir de
        Postgres restaurado com as permissões erradas não sobe.
    */
    const CloneVolume = async ({ sourceVolumeName, targetVolumeName, force = false }) => {
        if (!sourceVolumeName || !targetVolumeName) {
            const erro = new Error("Informe o volume de origem e o de destino.")
            erro.code = "INVALID_VOLUME_CLONE"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        await docker.getVolume(sourceVolumeName).inspect()

        let destinoExistia = true
        try {
            await docker.getVolume(targetVolumeName).inspect()
        } catch (error) {
            destinoExistia = false
            await docker.createVolume({ Name: targetVolumeName })
        }

        if (destinoExistia) await ExigirVolumeLivre(targetVolumeName, force, "clonar sobre")

        await ephemeral.EnsureVolumeExportImage()

        let container
        try {
            container = await docker.createContainer({
                Image: ephemeral.VOLUME_EXPORT_IMAGE,
                Cmd: ["sh", "-c", "cp -a /origem/. /destino/ 2>&1"],
                Tty: false,
                AttachStdout: true,
                AttachStderr: true,
                HostConfig: {
                    Binds: [
                        `${sourceVolumeName}:/origem:ro`,
                        `${targetVolumeName}:/destino`
                    ],
                    AutoRemove: false
                }
            })

            const saida = await ephemeral.RunEphemeralAndCollect(container)
            if (saida.statusCode !== 0) {
                throw new Error(
                    `Falha ao clonar ${sourceVolumeName} para ${targetVolumeName}: ` +
                    `${saida.stderr || saida.stdout}`)
            }

            return {
                sourceVolumeName,
                targetVolumeName,
                created: !destinoExistia,
                cloned: true
            }
        } catch (error) {
            console.error(`Error cloning volume ${sourceVolumeName}:`, error)
            throw error
        } finally {
            await ephemeral.RemoveEphemeral(container)
        }
    }

    return {
        ListAllVolumes,
        InspectVolume,
        CreateNewVolume,
        RemoveVolume,
        PruneVolumes,
        ExportVolume,
        ImportVolume,
        CloneVolume,
        EmptyVolume,
        GetVolumeUsage
    }
}

module.exports = CreateVolumeOperations
