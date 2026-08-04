/*
    Operações de CONTAINER (CTMG-36).

    Ciclo de vida, criação, inspeção, log e as três entregas contínuas — log ao
    vivo, métricas e terminal. Tudo o que responde à pergunta "o que este
    container está fazendo".

    Fábrica `(ctx) => ({ ...ops })`: o `docker` varia por conexão cadastrada, e
    os auxiliares compartilhados chegam pelo contexto em vez de serem importados
    aqui — quem compõe é o Container.manager.
*/

const { PassThrough } = require('node:stream')

const NormalizeContainerEnvironment =
    require("../Helpers/NormalizeContainerEnvironment")
const {
    BuildContainerNetworkConfiguration
} = require("../Helpers/BuildContainerNetworkConfiguration")
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

/*
    O ambiente de um exec pode chegar das duas formas que se usa por aí: o
    objeto `{ CHAVE: valor }` do resto deste pacote, ou a lista `["CHAVE=valor"]`
    da API do Docker. Aceitar as duas evita que quem já tem a lista pronta
    precise desmontá-la só para o adaptador remontar.
*/
const NormalizeExecEnvironment = (env) => {
    if (Array.isArray(env)) return env.map(String)
    return NormalizeContainerEnvironment(env)
}

const CreateContainerOperations = ({ docker, StreamToBuffer, SafeFileName }) => {

    const ListAllContainers = async () => {
        try {
            const containers = await docker.listContainers({ all: true })
            return containers
        } catch (error) {
            console.error('Error listing containers with details:', error)
            throw error
        }

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

    /*
        EXEC DE UMA TACADA (CTMG-42).

        `OpenExecSession` abre um terminal: TTY, entrada do usuário, sem fim
        previsto. Isto é o oposto — rode um comando, me devolva o que ele
        escreveu e com que código saiu. Metade das funcionalidades que faltam
        precisa disto e não do terminal: navegador de arquivos do container,
        healthcheck manual, clone de volume, diagnóstico.

        SEM TTY de propósito: é o que faz o runtime entregar stdout e stderr
        ENQUADRADOS e portanto separáveis. Com TTY os dois vêm misturados no
        mesmo fluxo, e "o que foi para o erro?" deixa de ter resposta — que é
        justamente a pergunta de quem chama isto.
    */
    const RunExec = async ({
        containerIdOrName,
        cmd,
        user,
        workingDir,
        env,
        timeoutMs = 30000
    }) => {
        if (!Array.isArray(cmd) || cmd.length === 0) {
            const erro = new Error(
                "Informe o comando como lista de argumentos, ex.: [\"sh\", \"-c\", \"ls -la\"]."
            )
            erro.code = "INVALID_EXEC_COMMAND"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        const container = docker.getContainer(containerIdOrName)

        const exec = await container.exec({
            Cmd: cmd.map(String),
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            ...(user ? { User: String(user) } : {}),
            ...(workingDir ? { WorkingDir: String(workingDir) } : {}),
            ...(env ? { Env: NormalizeExecEnvironment(env) } : {})
        })

        const stream = await exec.start({ hijack: true, stdin: false })

        let stdout = ""
        let stderr = ""

        // O mesmo decodificador do terminal: ele OBSERVA o formato em vez de
        // confiar no `Tty` que foi pedido — ver DecodeDockerStream.js.
        const decodificador = CreateDockerStreamDecoder({
            onData: ({ stream: fluxo, data }) => {
                if (fluxo === "stderr") stderr += data
                else stdout += data
            }
        })

        const timedOut = await new Promise((resolve, reject) => {
            let encerrado = false

            const Encerrar = (expirou) => {
                if (encerrado) return
                encerrado = true
                clearTimeout(temporizador)
                resolve(expirou)
            }

            /*
                Este temporizador NÃO leva `unref()`, ao contrário do de
                reconexão em System.ops.

                A diferença é quem espera: lá é uma tentativa de fundo, e um
                processo ocioso deve poder terminar apesar dela. Aqui alguém
                está `await`-ando esta promessa, e o temporizador é a única
                coisa capaz de resolvê-la quando o comando não termina.
                Soltá-lo do laço de eventos faria a promessa nunca resolver num
                processo sem outro trabalho — que é exatamente o caso de um
                script ou de um teste.
            */
            const temporizador = setTimeout(() => {
                try { stream.destroy() } catch (error) { /* já fechado */ }
                Encerrar(true)
            }, timeoutMs)

            stream.on("data", (pedaco) => decodificador.Push(pedaco))
            stream.on("end", () => Encerrar(false))
            stream.on("close", () => Encerrar(false))
            stream.on("error", (erro) => {
                if (encerrado) return
                encerrado = true
                clearTimeout(temporizador)
                reject(erro)
            })
        })

        decodificador.Flush()

        /*
            O código de saída vem do inspect do exec, não do stream.

            Quando expirou, ele costuma vir `null`: o processo AINDA ESTÁ
            RODANDO dentro do container. Soltar o fluxo não mata nada — a API
            do Docker não oferece como matar um exec. Por isso `timedOut` é um
            campo de resposta e não uma exceção: quem chamou precisa saber que
            deixou algo para trás.
        */
        let exitCode = null
        try {
            const detalhes = await exec.inspect()
            exitCode = detalhes && detalhes.ExitCode !== undefined ? detalhes.ExitCode : null
        } catch (error) {
            // Exec já colhido pelo runtime: sem código, e não é motivo para
            // descartar a saída que chegou.
        }

        return { exitCode, stdout, stderr, timedOut }
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

    return {
        ListAllContainers,
        CreateNewContainer,
        StartContainer,
        StopContainer,
        RestartContainer,
        KillContainer,
        RemoveContainer,
        InspectContainer,
        GetContainerLogHistory,
        ExportContainer,
        StreamContainerLogs,
        StreamContainerStats,
        OpenExecSession,
        RunExec
    }
}

module.exports = CreateContainerOperations
