import type { BuildProfile } from "./Types"

const fs = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const { spawn } = require("child_process") as typeof import("child_process")

// O worker é lançado como PROCESSO, e o caminho de um processo precisa da
// extensão de verdade — não há resolução de módulo no meio para completá-la.
// Por isso o arquivo é PROCURADO em vez de escrito com ".js" fixo: assim o
// lançamento continua correto quando ele troca de dialeto. O Node 22.18+
// executa .ts direto, por apagamento de tipos.
const _ResolveWorkerEntry = (): string => {
    const base = path.join(__dirname, "BuildWorkerEntry")
    return [`${base}.js`, `${base}.ts`].find((candidate) => fs.existsSync(candidate)) ?? `${base}.ts`
}

const WORKER_ENTRY = _ResolveWorkerEntry()

const DEFAULT_TIMEOUT_MS   = 600000  // 10 min: um build grande (3d-viewer) leva minutos
const READY_TIMEOUT_MS     = 120000  // sem "ready" nem progresso, algo está errado
const CLOSE_GRACE_MS       = 5000

// Procura um executável `node` nas entradas do PATH, sem lançar processo nenhum
// (um `which` aqui seria um spawn a mais só para descobrir se vale a pena
// spawnar).
const _FindNodeInPath = (env: NodeJS.ProcessEnv): string | undefined => {

    if(!env.PATH) return undefined

    for(const directory of env.PATH.split(path.delimiter)){

        if(!directory) continue

        const candidate = path.join(directory, "node")

        try {
            // X_OK, e não existsSync: um arquivo `node` sem bit de execução
            // falharia só no spawn, como ENOENT, longe da causa.
            fs.accessSync(candidate, fs.constants.X_OK)
        } catch(e) { continue }

        // O próprio binário empacotado pode estar no PATH sob esse nome —
        // relançá-lo devolveria exatamente o processo que se quer evitar.
        if(path.resolve(candidate) === path.resolve(process.execPath)) continue

        return candidate
    }

    return undefined
}

// Onde arranjar um "node" para rodar o worker.
//
// spawn, NUNCA fork: fork herda o execArgv do pai (um --inspect no processo
// principal viraria conflito de porta no filho), assume que execPath é node — o
// que é falso sob binário empacotado — e não deixa injetar flags de VM antes do
// script.
const ResolveWorkerRuntime = ({ env = process.env, smartRequire }: {
    env?: NodeJS.ProcessEnv
    smartRequire?: (moduleName: string) => any
} = {}): { command: string, env: NodeJS.ProcessEnv, kind: string } | undefined => {

    // 1. Caminho explícito vence tudo: é a válvula de escape quando a detecção
    //    automática erra numa máquina específica.
    if(env.META_WEBGUI_BUILD_NODE_PATH)
        return { command: env.META_WEBGUI_BUILD_NODE_PATH, env: {}, kind: "explicit" }

    // 2. Electron sabe virar node puro. É o caso que mais importa: uma janela
    //    desktop fica aberta por horas carregando o peso do build que fez ao abrir.
    if(process.versions && process.versions.electron)
        return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: "1" }, kind: "electron" }

    // 3. Node puro (o processo `run package` fora do binário empacotado).
    if(!(process as any).pkg && !(process.versions && (process.versions as any).pkg))
        return { command: process.execPath, env: {}, kind: "node" }

    // 4. Electron instalado como dependência npm, sob binário empacotado.
    if(smartRequire){
        try {
            const electronPath = smartRequire("electron")
            if(typeof electronPath === "string")
                return { command: electronPath, env: { ELECTRON_RUN_AS_NODE: "1" }, kind: "electron-npm" }
        } catch(e) { /* sem electron instalado */ }
    }

    // 5. Um `node` de verdade no PATH. É o caso do CONTAINER, e o que faz este
    //    recurso finalmente valer para os painéis: a imagem base é `node:22` e
    //    traz /usr/local/bin/node, mas quem hospeda o painel é o binário
    //    empacotado — então até aqui o build voltava para dentro dele, deixando
    //    o grafo de módulos do webpack no heap pelo resto da vida do processo.
    const nodeFromPath = _FindNodeInPath(env)
    if(nodeFromPath)
        return { command: nodeFromPath, env: {}, kind: "node-path" }

    // 6. Último recurso: o próprio binário empacotado sabe agir como node puro
    //    sob PKG_EXECPATH=PKG_INVOKE_NODEJS (verificado no binário instalado).
    //    Vem depois do PATH de propósito, por duas ressalvas que um `node` de
    //    verdade não tem: a variável PROPAGA para os netos — é o motivo do
    //    `unset PKG_EXECPATH` nos wrappers, e por isso o worker precisa limpá-la
    //    antes de lançar qualquer coisa —, e a versão do Node embutida é a do
    //    binário, que pode ser anterior ao apagamento de tipos que o
    //    BuildWorkerEntry.ts exige.
    return { command: process.execPath, env: { PKG_EXECPATH: "PKG_INVOKE_NODEJS" }, kind: "pkg-self" }
}

const CreateBuildWorkerClient = ({ smartRequire }: { smartRequire?: (moduleName: string) => any } = {}) => {

    const _Spawn = ({ runtime, profile, onLog }: { runtime: any, profile?: BuildProfile, onLog?: (level: string, text: string) => void }) => {
        const args: string[] = []
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

        const _Pipe = (stream: NodeJS.ReadableStream | null, level: string) => {
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
    const _Terminate = (child: import("child_process").ChildProcess) => {
        if(!child || child.killed || child.exitCode !== null) return
        try { child.kill("SIGTERM") } catch(e) { /* já morreu */ }
        const timer = setTimeout(() => {
            try { if(child.exitCode === null) child.kill("SIGKILL") } catch(e) {}
        }, CLOSE_GRACE_MS)
        if(timer.unref) timer.unref()
    }

    const _Attach = ({ child, onProgress, onLog, settle }: {
        child: import("child_process").ChildProcess
        onProgress?: (percentage: number) => void
        onLog?: (level: string, text: string) => void
        settle: (message: any) => void
    }) => {
        // Se o pai morrer, o worker vai junto: um build órfão continuaria
        // consumindo CPU e disco sem ninguém para receber o resultado.
        const killOnExit = () => _Terminate(child)
        process.once("exit", killOnExit)

        const detach = () => process.removeListener("exit", killOnExit)

        child.on("message", (message: any) => {
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
    const RunBuildInWorker = ({ job, profile, onProgress, onLog, timeoutMs = DEFAULT_TIMEOUT_MS }: {
        job: any
        profile?: BuildProfile
        onProgress?: (percentage: number) => void
        onLog?: (level: string, text: string) => void
        timeoutMs?: number
    }): Promise<any> =>
        new Promise((resolve, reject) => {
            const runtime = ResolveWorkerRuntime({ smartRequire })
            if(!runtime) return reject(new Error("nenhum runtime disponível para o worker de build"))

            const child = _Spawn({ runtime, profile, onLog })

            let isSettled = false
            let timer: NodeJS.Timeout

            const finish = (error: Error | null, value?: any) => {
                if(isSettled) return
                isSettled = true
                clearTimeout(timer)
                _Terminate(child)
                error ? reject(error) : resolve(value)
            }

            const settle = (message: any) => {
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
    const StartWatchWorker = ({ job, profile, onProgress, onRebuild, onLog, onExit, timeoutMs = DEFAULT_TIMEOUT_MS }: {
        job: any
        profile?: BuildProfile
        onProgress?: (percentage: number) => void
        onRebuild?: (summary: any) => void
        onLog?: (level: string, text: string) => void
        onExit?: (code: number | null, signal: string | null) => void
        timeoutMs?: number
    }): Promise<any> =>
        new Promise((resolve, reject) => {
            const runtime = ResolveWorkerRuntime({ smartRequire })
            if(!runtime) return reject(new Error("nenhum runtime disponível para o worker de build"))

            const child = _Spawn({ runtime, profile, onLog })

            let hasResolved = false
            let timer: NodeJS.Timeout

            const Close = () => new Promise<void>((done) => {
                if(child.exitCode !== null) return done()
                child.once("exit", () => done())
                try { child.send({ type: "close" }) } catch(e) { /* canal já fechado */ }
                _Terminate(child)
            })

            const settle = (message: any) => {
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
CreateBuildWorkerClient.FindNodeInPath        = _FindNodeInPath
CreateBuildWorkerClient.WORKER_ENTRY         = WORKER_ENTRY
CreateBuildWorkerClient.READY_TIMEOUT_MS     = READY_TIMEOUT_MS

module.exports = CreateBuildWorkerClient
