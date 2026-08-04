const Docker = require('dockerode')
const EventEmitter = require('node:events')
const { PassThrough } = require('node:stream')
const NormalizeContainerEnvironment =
    require("../Helpers/NormalizeContainerEnvironment")
const {
    BuildContainerNetworkConfiguration,
    NormalizeNetworkAliases
} = require("../Helpers/BuildContainerNetworkConfiguration")
// TAR mínimo escrito à mão — a API do Docker só troca arquivo com container por
// TAR, e este pacote tem uma dependência declarada só (VDRP-260).
const {
    BuildTarWithSingleFile,
    ExtractFirstFileFromTar
} = require("../Helpers/TarSingleFile")
// Contenção de caminho: função pura, em arquivo próprio, para poder ser
// verificada sem Docker (VDRP-260).
const {
    RequireSafeVolumePath,
    RequireSafeFileName,
    VOLUME_MOUNT_PATH
} = require("../Helpers/ResolveVolumeEntryPath")
// Desenquadra o fluxo binário do runtime — que vem multiplexado ou cru, e nem
// sempre no formato que foi pedido (CTMG-21).
const CreateDockerStreamDecoder = require("../Helpers/DecodeDockerStream")
// Traduz montagens, portas e grupos do host para o que a API espera, recusando
// o que não reconhece em vez de descartar em silêncio (CTMG-26, 28, 31).
const {
    NormalizeMounts,
    NormalizePorts,
    ResolveGroupAdd
} = require("../Helpers/NormalizeContainerCreateInput")

const DOCKER_EVENT = Symbol('dockerEvent')

// Imagem leve usada para exportar volumes via container efêmero.
const VOLUME_EXPORT_IMAGE = 'alpine:latest'

// Coleta todo o conteúdo de um stream legível em um único Buffer.
const StreamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = []
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
    })

const NormalizedLabels = (labels) => {
    return Object.fromEntries(
        Object.entries(labels).map(([key, value]) => [ key, value == null ? "" : String(value) ])
    )
}


const ContainerManager = (params) => {

    
    const eventEmitter = new EventEmitter()
    
    const {
        onReady,
        socketPath,
        // Conexão já resolvida (socket unix OU host TCP), usada quando o
        // adaptador é instanciado por conexão em vez de fixado no boot
        // (ContainerRuntimeConnection.manager, CTMG-8). `socketPath` continua
        // sendo o caminho de quem monta este serviço pelo boot.json.
        connectionOptions,
        /*
            O cliente do runtime entra por parâmetro (CTMG-29) para que o
            MAPEAMENTO de campos possa ser verificado sem daemon nenhum.

            Este manager traduz um punhado de campos hoje e vai traduzir umas
            seis dezenas: é justamente essa tradução que precisa de teste, e
            ela não deveria exigir Docker instalado para ser exercitada. O
            padrão é o cliente de verdade, então nada muda para quem já usa.
        */
        CreateClient = (options) => new Docker(options)
    } = params

    const docker = CreateClient(connectionOptions || { socketPath })

    /*
        STREAM DE EVENTOS SOB DEMANDA (CTMG-32).

        Antes o stream era aberto na construção do adaptador. Como o
        gerenciador de conexões mantém um adaptador em cache POR CONEXÃO, isso
        significava um socket aberto por conexão cadastrada — mesmo sem
        ninguém escutando. Uma conexão remota fora do ar enchia o log com o
        mesmo erro, repetidamente, enquanto o app trabalhava noutra conexão.

        Agora o stream abre no primeiro assinante e fecha quando sai o último.
        A reconexão usa backoff porque runtime que caiu costuma demorar a
        voltar, e tentar a cada 100 ms só transforma a queda em ruído.
    */
    const RECONEXAO_INICIAL_MS = 1000
    const RECONEXAO_MAXIMA_MS = 30000

    let eventStream = null
    let assinantes = 0
    let ultimoErro = null
    let esperaAtualMs = RECONEXAO_INICIAL_MS
    let temporizadorDeReconexao = null
    let desligado = false

    const _AgendarReconexao = () => {
        if (desligado || assinantes === 0 || temporizadorDeReconexao) return

        temporizadorDeReconexao = setTimeout(() => {
            temporizadorDeReconexao = null
            _AbrirEventStream()
        }, esperaAtualMs)

        // Não segura o processo vivo só por causa da tentativa de reconexão.
        if (typeof temporizadorDeReconexao.unref === "function") temporizadorDeReconexao.unref()

        esperaAtualMs = Math.min(esperaAtualMs * 2, RECONEXAO_MAXIMA_MS)
    }

    const _AbrirEventStream = () => {
        if (desligado || eventStream || assinantes === 0) return

        docker.getEvents({}, (err, stream) => {
            if (err) {
                ultimoErro = err
                _AgendarReconexao()
                return
            }

            if (assinantes === 0) {
                // O último assinante saiu enquanto o stream abria.
                try { stream.destroy() } catch (error) { /* já fechado */ }
                return
            }

            eventStream = stream
            ultimoErro = null
            esperaAtualMs = RECONEXAO_INICIAL_MS

            stream.on("data", (chunk) => {
                try {
                    eventEmitter.emit(DOCKER_EVENT, JSON.parse(chunk.toString()))
                } catch (parseErr) {
                    // Linha parcial ou keep-alive: não é motivo para poluir o log.
                }
            })

            stream.on("error", (erro) => {
                ultimoErro = erro
                eventStream = null
                _AgendarReconexao()
            })

            stream.on("end", () => {
                eventStream = null
                _AgendarReconexao()
            })
        })
    }

    const _FecharEventStream = () => {
        if (temporizadorDeReconexao) {
            clearTimeout(temporizadorDeReconexao)
            temporizadorDeReconexao = null
        }
        if (!eventStream) return
        try { eventStream.destroy() } catch (error) { /* já fechado */ }
        eventStream = null
    }

    const _RegistrarAssinante = () => {
        assinantes += 1
        if (assinantes === 1) _AbrirEventStream()
    }

    const _RemoverAssinante = () => {
        assinantes = Math.max(0, assinantes - 1)
        if (assinantes === 0) _FecharEventStream()
    }

    const GetEventStreamState = () => ({
        open: Boolean(eventStream),
        subscribers: assinantes,
        lastError: ultimoErro ? (ultimoErro.message || String(ultimoErro)) : null,
        retryInMs: temporizadorDeReconexao ? esperaAtualMs : null
    })

    const _Start = async () => {
        // Montado pelo boot.json, `onReady` sinaliza o supervisor. Instanciado
        // por conexão, não há supervisor para avisar — e a ausência do sinal
        // não pode derrubar o adaptador.
        if (typeof onReady === "function") onReady()
    }

    _Start()

    const ListAllContainers = async () => {
        try {
            const containers = await docker.listContainers({ all: true })
            return containers
        } catch (error) {
            console.error('Error listing containers with details:', error)
            throw error
        }

    }

    const ListAllImages = async () => {
        try {
            const images = await docker.listImages()
            return images
        }
        catch (error) {
            console.error('Error listing images:', error)
            throw error
        }

    }

    const ListAllNetworks = async () => {
        try {
            const networks = await docker.listNetworks()
            return networks
        }
        catch (error) {
            console.error('Error listing networks:', error)
            throw error
        }

    }

    /*
        O ERRO DO BUILD VEM NO STREAM, NÃO NO EVENTO 'error' (VDRP-269).

        Quando um passo do `docker build` falha, o daemon não emite erro de
        stream: ele manda um evento `{"error": ..., "errorDetail": {...}}` dentro
        do `data` e ENCERRA normalmente. A versão anterior só observava 'end' e
        ia inspecionar uma imagem que nunca foi criada — o operador recebia
        "(HTTP code 404) no such image", que é o sintoma, e a causa real ficava
        enterrada no log do build.

        Custou um diagnóstico inteiro num log de 48 MB para descobrir que o
        motivo era outro (VDRP-268). Com o erro certo propagado, é imediato.

        `onData` continua recebendo TUDO, inclusive o evento de erro: quem
        registra o histórico de build precisa do log completo, não da versão
        filtrada.
    */
    const BuildImageFromDockerfileString = async ({
        buildargs,
        contextTarStream, imageTagName, onData
    }) => {
        return new Promise((resolve, reject) => {

            docker.buildImage(contextTarStream, { t: imageTagName, buildargs }, (err, stream) => {
                if (err) return reject(err)

                let buildError = null

                stream.on('data', (chunk) => {
                    if (typeof onData === "function") onData(chunk)

                    /*
                        Um chunk pode trazer mais de um JSON por linha, e linhas
                        parciais acontecem. Uma linha que não parseia é log
                        comum — nunca motivo para derrubar o build aqui.
                    */
                    for (const linha of chunk.toString("utf-8").split("\n")) {
                        const texto = linha.trim()
                        if (texto.length === 0) continue
                        try {
                            const evento = JSON.parse(texto)
                            if (evento.error || evento.errorDetail) {
                                buildError = evento.errorDetail?.message ?? evento.error
                            }
                        } catch {
                            // linha não-JSON: segue
                        }
                    }
                })

                stream.on('end', async () => {
                    if (buildError) {
                        const error = new Error(`Falha no build da imagem ${imageTagName}: ${buildError}`)
                        error.code = "IMAGE_BUILD_FAILED"
                        return reject(error)
                    }
                    try {
                        const image = docker.getImage(imageTagName)
                        const imageInfo = await image.inspect()
                        resolve(imageInfo)
                    } catch (inspectErr) {
                        reject(inspectErr)
                    }
                })
                stream.on('error', reject)
            })
        })
    }

    /*
        Build a partir do TEXTO do Dockerfile (CTMG-16).

        A API do Docker só aceita contexto em TAR, e montar TAR é conhecimento
        de formato de arquivo — que uma interface gráfica não deveria precisar
        ter. Quem tem esse conhecimento é este pacote, que já empacota arquivo
        para escrever em volume. Então quem chama manda o texto, e o TAR nasce
        aqui.

        Contexto de UM arquivo só: o suficiente para um Dockerfile que não
        depende de COPY/ADD de arquivos locais. Build com contexto de verdade
        continua sendo `BuildImageFromDockerfileString` com o stream pronto.
    */
    const BuildImageFromDockerfileContent = async ({
        imageTagName,
        dockerfileContent,
        buildargs,
        onData
    }) => {
        if (typeof dockerfileContent !== "string" || dockerfileContent.trim() === "") {
            const erro = new Error("O conteúdo do Dockerfile é obrigatório.")
            erro.code = "DOCKERFILE_CONTENT_REQUIRED"
            throw erro
        }

        const contexto = BuildTarWithSingleFile({
            name: "Dockerfile",
            content: dockerfileContent
        })

        const contextTarStream = new PassThrough()
        contextTarStream.end(contexto)

        return await BuildImageFromDockerfileString({
            imageTagName,
            buildargs,
            onData,
            contextTarStream
        })
    }

    /*
        As três traduções que aqui aconteciam à mão — montagens, portas e
        grupos do host — vivem em NormalizeContainerCreateInput.js, testáveis
        sem daemon. Ver o cabeçalho daquele arquivo para o que estava errado
        (CTMG-26, CTMG-28, CTMG-31).
    */
    const CreateNewContainer = async ({
        imageName,
        containerName,
        ports = [],
        networkmode,
        networkAliases = [],
        mounts = [],
        environment = {},
        groupAdd,
        inheritHostGroups = false
    }) => {

        const { exposedPorts, portBindings } = NormalizePorts(ports)
        const normalizedMounts = NormalizeMounts(mounts)
        const gruposSuplementares = ResolveGroupAdd({ groupAdd, inheritHostGroups })

        const environmentVariables =
            NormalizeContainerEnvironment(environment)
        const networkConfiguration =
            BuildContainerNetworkConfiguration({
                networkmode,
                networkAliases
            })

        const container = await docker.createContainer({
            Image: imageName,
            name: containerName,
            ...(environmentVariables.length > 0
                ? { Env: environmentVariables }
                : {}),
            ExposedPorts: exposedPorts,
            HostConfig: {
                PortBindings: portBindings,
                NetworkMode: networkmode,
                Mounts: normalizedMounts,
                ...(gruposSuplementares.length > 0
                    ? { GroupAdd: gruposSuplementares }
                    : {})
            },
            ...networkConfiguration
        })

        const containerInfo = await container.inspect()
        return containerInfo
    }

    const RemoveContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.remove({ 
                force: false, 
                v: false 
            })
            return { success: true, message: `Container ${containerIdOrName} removed successfully` }
        } catch (error) {
            console.error(`Error removing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const StartContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.start()
            return { success: true, message: `Container ${containerIdOrName} started successfully` }
        } catch (error) {
            console.error(`Error starting container ${containerIdOrName}:`, error)
            throw error
        }
    }
    
    const StopContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.stop()
            return { success: true, message: `Container ${containerIdOrName} stopped successfully` }
        } catch (error) {
            console.error(`Error stopping container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const RestartContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.restart()
            return { success: true, message: `Container ${containerIdOrName} restarted successfully` }
        } catch (error) {
            console.error(`Error restarting container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const KillContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.kill()
            return { success: true, message: `Container ${containerIdOrName} killed successfully` }
        } catch (error) {
            console.error(`Error killing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const InspectContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const containerInfo = await container.inspect()
            return containerInfo
        } catch (error) {
            console.error(error)
            return null
        }
    }

    /*
        LOG AO VIVO (CTMG-23).

        `GetContainerLogHistory` devolve o que já aconteceu; isto acompanha o
        que está acontecendo. A diferença que importa para quem chama: aqui não
        há retorno, há um assinante — `onData` recebe cada pedaço à medida que
        o container escreve.

        Container sem TTY entrega o log MULTIPLEXADO (quadros de 8 bytes com
        stdout e stderr misturados no mesmo fluxo). `demuxStream` separa os
        dois; sem isso, o cabeçalho binário apareceria no meio do texto.

        Devolve um `Close`: stream de log segurado é conexão aberta com o
        runtime, e quem abriu precisa poder soltar.
    */
    const StreamContainerLogs = async ({
        containerIdOrName,
        tail = 200,
        onData,
        onError,
        onEnd
    }) => {
        const container = docker.getContainer(containerIdOrName)

        const stream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
            tail,
            timestamps: false
        })

        const saida = new PassThrough()
        const erro = new PassThrough()

        saida.on("data", (pedaco) => onData && onData({ stream: "stdout", data: pedaco.toString("utf-8") }))
        erro.on("data", (pedaco) => onData && onData({ stream: "stderr", data: pedaco.toString("utf-8") }))

        try {
            container.modem.demuxStream(stream, saida, erro)
        } catch (error) {
            // TTY: o fluxo já vem limpo, sem quadros para separar.
            stream.on("data", (pedaco) => onData && onData({ stream: "stdout", data: pedaco.toString("utf-8") }))
        }

        stream.on("error", (error) => onError && onError(error))
        stream.on("end", () => onEnd && onEnd())

        return {
            Close: () => {
                try { stream.destroy() } catch (error) { /* já fechado */ }
            }
        }
    }

    /*
        MÉTRICAS AO VIVO (CTMG-22).

        O runtime entrega uma amostra por segundo, em JSON, com contadores
        ACUMULADOS de CPU. Percentual de CPU não vem pronto: é a variação entre
        duas amostras — por isso o cálculo acontece aqui, uma vez, e não em
        cada tela que quiser mostrar o número.
    */
    const StreamContainerStats = async ({ containerIdOrName, onData, onError, onEnd }) => {
        const container = docker.getContainer(containerIdOrName)
        const stream = await container.stats({ stream: true })

        let restante = ""

        const CalcularCpu = (amostra) => {
            const cpu = amostra.cpu_stats || {}
            const anterior = amostra.precpu_stats || {}
            const deltaCpu = (cpu.cpu_usage?.total_usage || 0) - (anterior.cpu_usage?.total_usage || 0)
            const deltaSistema = (cpu.system_cpu_usage || 0) - (anterior.system_cpu_usage || 0)
            const nucleos = cpu.online_cpus || (cpu.cpu_usage?.percpu_usage || []).length || 1
            if (deltaSistema <= 0 || deltaCpu <= 0) return 0
            return (deltaCpu / deltaSistema) * nucleos * 100
        }

        stream.on("data", (pedaco) => {
            restante += pedaco.toString("utf-8")
            const linhas = restante.split("\n")
            restante = linhas.pop() || ""

            linhas
                .filter((linha) => linha.trim() !== "")
                .forEach((linha) => {
                    let amostra
                    try {
                        amostra = JSON.parse(linha)
                    } catch (error) {
                        return
                    }

                    const memoriaUsada = (amostra.memory_stats?.usage || 0) - (amostra.memory_stats?.stats?.cache || 0)
                    const memoriaLimite = amostra.memory_stats?.limit || 0
                    const redes = amostra.networks || {}
                    const rede = Object.keys(redes).reduce((total, nome) => ({
                        rx: total.rx + (redes[nome].rx_bytes || 0),
                        tx: total.tx + (redes[nome].tx_bytes || 0)
                    }), { rx: 0, tx: 0 })

                    const blocos = (amostra.blkio_stats?.io_service_bytes_recursive || [])
                        .reduce((total, entrada) => {
                            const operacao = String(entrada.op || "").toLowerCase()
                            if (operacao === "read") total.read += entrada.value || 0
                            if (operacao === "write") total.write += entrada.value || 0
                            return total
                        }, { read: 0, write: 0 })

                    onData && onData({
                        readAt: amostra.read,
                        cpuPercent: Number(CalcularCpu(amostra).toFixed(2)),
                        memoryUsage: memoriaUsada,
                        memoryLimit: memoriaLimite,
                        memoryPercent: memoriaLimite > 0
                            ? Number(((memoriaUsada / memoriaLimite) * 100).toFixed(2))
                            : 0,
                        networkRx: rede.rx,
                        networkTx: rede.tx,
                        blockRead: blocos.read,
                        blockWrite: blocos.write,
                        pids: amostra.pids_stats?.current || 0
                    })
                })
        })

        stream.on("error", (error) => onError && onError(error))
        stream.on("end", () => onEnd && onEnd())

        return {
            Close: () => {
                try { stream.destroy() } catch (error) { /* já fechado */ }
            }
        }
    }

    /*
        TERMINAL DENTRO DO CONTAINER (CTMG-21).

        Sessão de `exec` com TTY: entrada e saída ao vivo, como um shell.

        O shell é escolhido por TENTATIVA em ordem — nem toda imagem tem bash,
        e muitas (alpine, distroless-ish) só têm sh. Pedir bash direto faria o
        terminal falhar em metade dos containers, com um erro que não explica
        nada a quem só queria "abrir um terminal".

        Com TTY ligado não há multiplexação: o fluxo é bidirecional e limpo.
    */
    const OpenExecSession = async ({
        containerIdOrName,
        cmd,
        cols = 80,
        rows = 24,
        onData,
        onError,
        onEnd
    }) => {
        const container = docker.getContainer(containerIdOrName)

        const comando = Array.isArray(cmd) && cmd.length > 0
            ? cmd
            : ["/bin/sh", "-c", "command -v bash >/dev/null 2>&1 && exec bash || exec sh"]

        const exec = await container.exec({
            Cmd: comando,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true
        })

        const stream = await exec.start({ hijack: true, stdin: true })

        /*
            Mesmo pedindo TTY, o runtime pode devolver o fluxo enquadrado — foi
            o que aconteceu num container criado sem TTY. O decodificador
            observa o formato em vez de confiar no que foi pedido.
        */
        const decodificador = CreateDockerStreamDecoder({
            onData: ({ data }) => onData && onData(data)
        })

        stream.on("data", (pedaco) => decodificador.Push(pedaco))
        stream.on("error", (error) => onError && onError(error))
        stream.on("end", () => {
            decodificador.Flush()
            onEnd && onEnd()
        })

        try {
            await exec.resize({ h: rows, w: cols })
        } catch (error) {
            // Redimensionar é conforto, não requisito: se falhar, o terminal
            // continua utilizável no tamanho padrão.
        }

        return {
            Write: (dados) => {
                try { stream.write(dados) } catch (error) { onError && onError(error) }
            },
            Resize: async ({ cols: colunas, rows: linhas }) => {
                try { await exec.resize({ h: linhas, w: colunas }) } catch (error) { /* ver acima */ }
            },
            Inspect: () => exec.inspect(),
            Close: () => {
                try { stream.end() } catch (error) { /* já fechado */ }
                try { stream.destroy() } catch (error) { /* já fechado */ }
            }
        }
    }

    const GetContainerLogHistory = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const logBuffer = await container.logs({
                stdout: true,
                stderr: true,
                follow: false,
                tail: "all"
            })
            // If docker returned a Buffer it may contain multiplexed headers when
            // the container was not started with a TTY. Those headers are 8-byte
            // frames: [streamType(1)][0][0][0][length(4-be)]...payload...
            // Parse and strip them so the output keeps ANSI sequences (colors)
            // and line breaks intact for TTY display.
            if (Buffer.isBuffer(logBuffer)) {
                const buf = logBuffer
                // quick detection: first byte 0x01 or 0x02 and next three bytes 0x00
                if (buf.length >= 8 && (buf[0] === 1 || buf[0] === 2) && buf[1] === 0 && buf[2] === 0 && buf[3] === 0) {
                    let idx = 0
                    const outChunks = []
                    while (idx + 8 <= buf.length) {
                        const streamType = buf[idx]
                        const payloadLen = buf.readUInt32BE(idx + 4)
                        const start = idx + 8
                        const end = start + payloadLen
                        if (end > buf.length) {
                            // malformed/truncated frame: push remainder and break
                            outChunks.push(buf.slice(start))
                            break
                        }
                        const payload = buf.slice(start, end)
                        outChunks.push(payload)
                        idx = end
                    }
                    try {
                        // return as base64 so transport (JSON) doesn't escape ANSI bytes
                        return { isBase64: true, data: Buffer.concat(outChunks).toString('base64') }
                    } catch (e) {
                        return { isBase64: true, data: Buffer.concat(outChunks).toString('base64') }
                    }
                }
                // not multiplexed - return UTF-8 string
                try {
                    return { isBase64: true, data: buf.toString('base64') }
                } catch (e) {
                    return { isBase64: true, data: buf.toString('base64') }
                }
            }

            // if not a Buffer, stringify and return as plain text
            if (typeof logBuffer === 'string') {
                return { isBase64: false, data: logBuffer }
            }

            return { isBase64: false, data: String(logBuffer) }
        } catch (error) {
            console.error(`Error getting logs for container ${containerIdOrName}:`, error)
            throw error 
        }
    }


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

    /*
        Assina os eventos do runtime. A assinatura é o que ABRE o stream — ver
        o bloco de eventos sob demanda no topo (CTMG-32).

        Devolve `Unsubscribe`. Quem não chamar continua funcionando como antes,
        mas segura o stream aberto: o retorno existe para que dê para soltar.
    */
    const RegisterDockerEventListener = (f) => {
        const ouvinte = (eventData) => f(eventData)
        eventEmitter.on(DOCKER_EVENT, ouvinte)
        _RegistrarAssinante()

        let removido = false
        return () => {
            if (removido) return
            removido = true
            eventEmitter.removeListener(DOCKER_EVENT, ouvinte)
            _RemoverAssinante()
        }
    }

    const InspectNetwork = async (networkIdOrName) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            const networkInfo = await network.inspect()
            return networkInfo
        }
        catch (error) {
            console.error(`Error inspecting network ${networkIdOrName}:`, error)
            throw error
        }
    }

    const CreateNewNetwork = async (options) => {
        try {
            const network = await docker.createNetwork(options)
            return network
        }
        catch (error) {
            console.error(`Error creating network ${options.Name || 'unknown'}:`, error)
            throw error
        }
    }

    const RemoveNetwork = async (networkIdOrName) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            await network.remove()
            return { success: true, message: `Network ${networkIdOrName} removed successfully` }
        }
        catch (error) {
            console.error(`Error removing network ${networkIdOrName}:`, error)
            throw error
        }
    }

    // "Edição" de network no Docker = conectar/desconectar containers
    // (não existe update in-place da configuração de uma network).
    const ConnectContainerToNetwork = async ({
        networkIdOrName,
        containerIdOrName,
        aliases = []
    }) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            const normalizedAliases = NormalizeNetworkAliases(aliases)
            await network.connect({
                Container: containerIdOrName,
                ...(normalizedAliases.length > 0
                    ? {
                        EndpointConfig: {
                            Aliases: normalizedAliases
                        }
                    }
                    : {})
            })
            return { success: true, message: `Container ${containerIdOrName} connected to ${networkIdOrName}` }
        }
        catch (error) {
            console.error(`Error connecting container ${containerIdOrName} to network ${networkIdOrName}:`, error)
            throw error
        }
    }

    const DisconnectContainerFromNetwork = async ({ networkIdOrName, containerIdOrName }) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            await network.disconnect({ Container: containerIdOrName, Force: true })
            return { success: true, message: `Container ${containerIdOrName} disconnected from ${networkIdOrName}` }
        }
        catch (error) {
            console.error(`Error disconnecting container ${containerIdOrName} from network ${networkIdOrName}:`, error)
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

    const InspectImage = async (imageIdOrName) => {
        try {
            const image = docker.getImage(imageIdOrName)
            const imageInfo = await image.inspect()
            return imageInfo
        } catch (error) {
            console.error(`Error inspecting image ${imageIdOrName}:`, error)
            throw error
        }
    }

    const RemoveImage = async ({ imageIdOrName, force = false }) => {
        try {
            const image = docker.getImage(imageIdOrName)
            await image.remove({ force })
            return { success: true, message: `Image ${imageIdOrName} removed successfully` }
        } catch (error) {
            console.error(`Error removing image ${imageIdOrName}:`, error)
            throw error
        }
    }

    // Gera um nome de arquivo seguro a partir de um identificador qualquer.
    const SafeFileName = (value, fallback) => {
        const base = (value || fallback || "export")
            .toString()
            .replace(/^\//, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
        return base || fallback || "export"
    }

    // Exporta uma imagem (equivalente a `docker save`) — retorna um tar em base64.
    // ATENÇÃO: o tar inteiro é carregado em memória (limitação do contrato JSON
    // do controller). Imagens muito grandes podem consumir bastante memória.
    const ExportImage = async (imageIdOrName) => {
        try {
            const image = docker.getImage(imageIdOrName)
            const stream = await image.get()
            const buffer = await StreamToBuffer(stream)
            return {
                isBase64 : true,
                fileName : `${SafeFileName(imageIdOrName, "image")}.tar`,
                mimeType : "application/x-tar",
                data     : buffer.toString("base64")
            }
        } catch (error) {
            console.error(`Error exporting image ${imageIdOrName}:`, error)
            throw error
        }
    }

    // Exporta o filesystem de um container (equivalente a `docker export`)
    // — retorna um tar em base64.
    const ExportContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const stream = await container.export()
            const buffer = await StreamToBuffer(stream)
            return {
                isBase64 : true,
                fileName : `${SafeFileName(containerIdOrName, "container")}.tar`,
                mimeType : "application/x-tar",
                data     : buffer.toString("base64")
            }
        } catch (error) {
            console.error(`Error exporting container ${containerIdOrName}:`, error)
            throw error
        }
    }

    // Garante que a imagem usada para exportar volumes esteja disponível localmente.
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

    /*
        ARQUIVOS DENTRO DE UM VOLUME (VDRP-260).

        Não existe API do Docker para ler ou escrever num volume diretamente —
        volume só é acessível de dentro de um container. `ExportVolume` (acima)
        já resolvia isso para "leve tudo embora"; estes quatro métodos são o
        mesmo padrão para as operações que faltavam: listar, escrever, ler um
        arquivo e apagar.

        O container efêmero NUNCA É INICIADO em Put/Get: `putArchive` e
        `getArchive` operam sobre o sistema de arquivos do container criado, e
        nenhum processo do usuário chega a rodar. Em List/Delete ele roda um
        comando de shell da imagem alpine (não do usuário) e morre em seguida.

        CAMINHO É SEMPRE RELATIVO À RAIZ DO VOLUME e conferido aqui, na entrada:
        qualquer ".." ou caminho absoluto é recusado ANTES de tocar no Docker.
        Este módulo é a última fronteira antes do sistema de arquivos real — a
        checagem de quem é dono do volume acontece muito antes, no Platform
        Manager, mas contenção de caminho é responsabilidade de quem executa.
    */
    /*
        Contenção de caminho vive em Helpers/ResolveVolumeEntryPath.js — função
        pura, testável sem socket, sem imagem e sem container. Aqui só se
        aplica.
    */
    const RequireSafePath = (relativePath) => RequireSafeVolumePath(relativePath)

    /*
        Cria o container efêmero com o volume montado. `readOnly` existe para as
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

    const RemoveEphemeral = async (container) => {
        if (!container) return
        try {
            await container.remove({ force: true })
        } catch (cleanupError) {
            console.error("Error removing temporary volume container:", cleanupError)
        }
    }

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
        StartContainer,
        StopContainer,
        RestartContainer,
        KillContainer,
        RemoveContainer,
        ListAllContainers,
        ListAllVolumes,
        BuildImageFromDockerfileString,
        BuildImageFromDockerfileContent,
        CreateNewContainer,
        InspectContainer,
        ListAllImages,
        ListAllNetworks,
        RegisterDockerEventListener,
        GetEventStreamState,
        GetContainerLogHistory,
        StreamContainerLogs,
        StreamContainerStats,
        OpenExecSession,
        InspectNetwork,
        CreateNewNetwork,
        RemoveNetwork,
        ConnectContainerToNetwork,
        DisconnectContainerFromNetwork,
        InspectVolume,
        CreateNewVolume,
        RemoveVolume,
        ListVolumeEntries,
        PutFileInVolume,
        GetFileFromVolume,
        DeleteVolumeEntry,
        InspectImage,
        RemoveImage,
        ExportImage,
        ExportContainer,
        ExportVolume
    }

}

module.exports = ContainerManager
