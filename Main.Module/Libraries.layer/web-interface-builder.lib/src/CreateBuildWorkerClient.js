const path = require("path")
const { spawn } = require("child_process")

const WORKER_ENTRY = path.join(__dirname, "BuildWorkerEntry.js")

const DEFAULT_TIMEOUT_MS   = 600000  // 10 min: um build grande (3d-viewer) leva minutos
const READY_TIMEOUT_MS     = 120000  // sem "ready" nem progresso, algo está errado
const CLOSE_GRACE_MS       = 5000

// Onde arranjar um "node" para rodar o worker.
//
// spawn, NUNCA fork: fork herda o execArgv do pai (um --inspect no processo
// principal viraria conflito de porta no filho), assume que execPath é node — o
// que é falso sob binário empacotado — e não deixa injetar flags de VM antes do
// script.
const ResolveWorkerRuntime = ({ env = process.env, smartRequire } = {}) => {

    // 1. Caminho explícito vence tudo: é a válvula de escape quando a detecção
    //    automática erra numa máquina específica.
    if(env.META_WEBGUI_BUILD_NODE_PATH)
        return { command: env.META_WEBGUI_BUILD_NODE_PATH, env: {}, kind: "explicit" }

    // 2. Electron sabe virar node puro. É o caso que mais importa: uma janela
    //    desktop fica aberta por horas carregando o peso do build que fez ao abrir.
    if(process.versions && process.versions.electron)
        return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: "1" }, kind: "electron" }

    // 3. Node puro (o processo `run package` fora do binário empacotado).
    if(!process.pkg && !(process.versions && process.versions.pkg))
        return { command: process.execPath, env: {}, kind: "node" }

    // 4. Binário empacotado: ele reconhece PKG_INVOKE_NODEJS, mas isso depende
    //    da versão do binário instalado e a variável PROPAGA para os netos (é o
    //    motivo do `unset PKG_EXECPATH` nos wrappers). Fora do escopo desta
    //    entrega, que isola só o caminho Electron — o daemon segue compilando
    //    no próprio processo, onde o perfil release já derrubou o custo.
    if(smartRequire){
        try {
            const electronPath = smartRequire("electron")
            if(typeof electronPath === "string")
                return { command: electronPath, env: { ELECTRON_RUN_AS_NODE: "1" }, kind: "electron-npm" }
        } catch(e) { /* sem electron instalado */ }
    }

    return undefined
}

const CreateBuildWorkerClient = ({ smartRequire } = {}) => {

    const _Spawn = ({ runtime, profile, onLog }) => {
        const args = []
        // O teto de heap é do FILHO: ele pode ser generoso porque a memória
        // volta inteira ao sistema quando o processo termina.
        if(profile && profile.maxOldSpaceMb) args.push(`--max-old-space-size=${profile.maxOldSpaceMb}`)
        args.push(WORKER_ENTRY)

        const child = spawn(runtime.command, args, {
            env: { ...process.env, ...runtime.env },
            // O canal "ipc" no descritor 4 é o que dá process.send dos dois lados.
            // stdout/stderr são canalizados, nunca herdados: herdar poluiria o
            // terminal do daemon com a saída de compilação.
            stdio: ["ignore", "pipe", "pipe", "ipc"],
            detached: false
        })

        const _Pipe = (stream, level) => {
            if(!stream) return
            stream.setEncoding("utf8")
            stream.on("data", (chunk) => {
                const text = String(chunk).trim()
                if(text && onLog) onLog(level, text)
            })
        }
        _Pipe(child.stdout, "info")
        _Pipe(child.stderr, "error")

        return child
    }

    // Mata o worker sem deixar órfão, mesmo que ele ignore o pedido educado.
    const _Terminate = (child) => {
        if(!child || child.killed || child.exitCode !== null) return
        try { child.kill("SIGTERM") } catch(e) { /* já morreu */ }
        const timer = setTimeout(() => {
            try { if(child.exitCode === null) child.kill("SIGKILL") } catch(e) {}
        }, CLOSE_GRACE_MS)
        if(timer.unref) timer.unref()
    }

    const _Attach = ({ child, onProgress, onLog, settle }) => {
        // Se o pai morrer, o worker vai junto: um build órfão continuaria
        // consumindo CPU e disco sem ninguém para receber o resultado.
        const killOnExit = () => _Terminate(child)
        process.once("exit", killOnExit)

        const detach = () => process.removeListener("exit", killOnExit)

        child.on("message", (message) => {
            if(!message) return
            if(message.type === "progress") return onProgress && onProgress(message.percentage)
            settle(message)
        })

        child.on("error", (error) => settle({ type: "error", message: error.message, stack: error.stack }))

        child.on("exit", (code, signal) => {
            detach()
            settle({ type: "exit", code, signal })
        })

        return detach
    }

    // Build de uma vez. Resolve com o resumo; rejeita em erro, timeout ou saída
    // anormal. Em nenhum caminho fica pendente.
    const RunBuildInWorker = ({ job, profile, onProgress, onLog, timeoutMs = DEFAULT_TIMEOUT_MS }) =>
        new Promise((resolve, reject) => {
            const runtime = ResolveWorkerRuntime({ smartRequire })
            if(!runtime) return reject(new Error("nenhum runtime disponível para o worker de build"))

            const child = _Spawn({ runtime, profile, onLog })

            let isSettled = false
            let timer

            const finish = (error, value) => {
                if(isSettled) return
                isSettled = true
                clearTimeout(timer)
                _Terminate(child)
                error ? reject(error) : resolve(value)
            }

            const settle = (message) => {
                if(message.type === "done")  return finish(null, message.summary)
                if(message.type === "error") return finish(new Error(message.message))
                if(message.type === "ready") return child.send({ type: "build", job })
                if(message.type === "exit" && !isSettled)
                    return finish(new Error(
                        `o worker de build terminou sem responder (código ${message.code}, sinal ${message.signal})`
                    ))
            }

            _Attach({ child, onProgress, onLog, settle })

            timer = setTimeout(
                () => finish(new Error(`o build excedeu ${Math.round(timeoutMs / 1000)}s e foi interrompido`)),
                timeoutMs
            )
            if(timer.unref) timer.unref()
        })

    // Watch. Resolve no PRIMEIRO build concluído, devolvendo o handle para
    // encerrar — o worker segue vivo, e com ele todo o custo do watcher.
    const StartWatchWorker = ({ job, profile, onProgress, onRebuild, onLog, onExit, timeoutMs = DEFAULT_TIMEOUT_MS }) =>
        new Promise((resolve, reject) => {
            const runtime = ResolveWorkerRuntime({ smartRequire })
            if(!runtime) return reject(new Error("nenhum runtime disponível para o worker de build"))

            const child = _Spawn({ runtime, profile, onLog })

            let hasResolved = false
            let timer

            const Close = () => new Promise((done) => {
                if(child.exitCode !== null) return done()
                child.once("exit", () => done())
                try { child.send({ type: "close" }) } catch(e) { /* canal já fechado */ }
                _Terminate(child)
            })

            const settle = (message) => {
                if(message.type === "ready") return child.send({ type: "build", job })

                if(message.type === "done" && !hasResolved){
                    hasResolved = true
                    clearTimeout(timer)
                    return resolve({ summary: message.summary, Close, pid: child.pid })
                }

                if(message.type === "rebuilt" || message.type === "done")
                    return onRebuild && onRebuild(message.summary)

                if(message.type === "error"){
                    // Antes do primeiro bundle não há o que servir: é fatal.
                    // Depois dele, erro de compilação é transitório — o
                    // desenvolvedor corrige e o próximo ciclo conserta.
                    if(!hasResolved){
                        hasResolved = true
                        clearTimeout(timer)
                        _Terminate(child)
                        return reject(new Error(message.message))
                    }
                    return onLog && onLog("error", message.message)
                }

                if(message.type === "exit"){
                    if(!hasResolved){
                        hasResolved = true
                        clearTimeout(timer)
                        return reject(new Error(`o worker de watch terminou antes do primeiro build (código ${message.code})`))
                    }
                    return onExit && onExit(message.code, message.signal)
                }
            }

            _Attach({ child, onProgress, onLog, settle })

            timer = setTimeout(() => {
                if(hasResolved) return
                hasResolved = true
                _Terminate(child)
                reject(new Error(`o primeiro build do watch excedeu ${Math.round(timeoutMs / 1000)}s`))
            }, timeoutMs)
            if(timer.unref) timer.unref()
        })

    return { RunBuildInWorker, StartWatchWorker, ResolveWorkerRuntime: () => ResolveWorkerRuntime({ smartRequire }) }
}

CreateBuildWorkerClient.ResolveWorkerRuntime = ResolveWorkerRuntime
CreateBuildWorkerClient.WORKER_ENTRY         = WORKER_ENTRY
CreateBuildWorkerClient.READY_TIMEOUT_MS     = READY_TIMEOUT_MS

module.exports = CreateBuildWorkerClient
