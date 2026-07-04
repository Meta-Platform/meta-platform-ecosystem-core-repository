const { spawn } = require("child_process")
const path = require("path")
const EventEmitter = require("events")

/**
 * Gerenciador de processos para rodar/debugar pacotes.
 *
 * Faz spawn do executável `run` (ou `run-dbg`) já instalado
 * (`run package <packagePath>`), captura stdout/stderr num buffer circular e
 * emite eventos de log ao vivo (para streaming à UI). Mantém estado dos
 * processos em execução (RUNNING/EXITED/ERROR).
 *
 * @param {object} opts
 * @param {string} opts.runCommandPath  caminho do executável `run` (o `run-dbg`
 *                                       é derivado como `${runCommandPath}-dbg`)
 * @param {number} [opts.maxLogLines]   tamanho do buffer de logs por processo
 */
const InitializeProcessManager = ({ runCommandPath, maxLogLines = 2000 } = {}) => {

    const executablesDir = runCommandPath ? path.dirname(runCommandPath) : undefined
    const processes = new Map() // id -> { child, status, logs:[], pid, debug }
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)

    const _append = (id, stream, line) => {
        const proc = processes.get(id)
        if(!proc) return
        const entry = { stream, line, ts: Date.now() }
        proc.logs.push(entry)
        if(proc.logs.length > maxLogLines) proc.logs.shift()
        emitter.emit(`log:${id}`, entry)
    }

    const _pipe = (id, stream, chunk) =>
        chunk.toString().split("\n").filter((l) => l.length > 0)
        .forEach((line) => _append(id, stream, line))

    // Roda um pacote. debug=true usa o `run-dbg` (abre o inspector do Node).
    const StartPackage = ({ id, packagePath, debug = false }) => {
        const current = processes.get(id)
        if(current && current.status === "RUNNING")
            throw `"${id}" já está em execução (pid ${current.pid})`

        if(!runCommandPath) throw "runCommandPath não configurado"

        const command = debug ? `${runCommandPath}-dbg` : runCommandPath

        // detached: true cria um novo grupo de processos (pgid = child.pid),
        // para que o Stop consiga matar toda a árvore (run -> pkg-exec -> pacote),
        // e não só o wrapper `run` (senão o servidor do pacote fica órfão).
        const child = spawn(command, ["package", packagePath], {
            cwd: executablesDir,
            env: { ...process.env, PATH: `${executablesDir}:${process.env.PATH}` },
            detached: true
        })

        const proc = { child, status: "RUNNING", logs: [], pid: child.pid, debug }
        processes.set(id, proc)

        _append(id, "system", `iniciando "${id}"${debug ? " (debug)" : ""} — pid ${child.pid}`)
        child.stdout.on("data", (chunk) => _pipe(id, "stdout", chunk))
        child.stderr.on("data", (chunk) => _pipe(id, "stderr", chunk))
        child.on("exit", (code, signal) => {
            proc.status = (code === 0 || signal === "SIGTERM") ? "STOPPED" : "ERROR"
            _append(id, "system", `processo encerrado (code=${code}, signal=${signal || "-"})`)
            emitter.emit(`status:${id}`, proc.status)
        })
        child.on("error", (err) => {
            proc.status = "ERROR"
            _append(id, "system", `erro ao iniciar: ${err.message}`)
            emitter.emit(`status:${id}`, proc.status)
        })

        return { id, pid: child.pid, status: "RUNNING", debug }
    }

    const StopPackage = (id) => {
        const proc = processes.get(id)
        if(!proc) return { id, status: "NOT_FOUND" }
        if(proc.status === "RUNNING"){
            // mata o grupo de processos inteiro (pgid negativo = -pid)
            try {
                process.kill(-proc.pid, "SIGTERM")
            } catch (e) {
                try { proc.child.kill("SIGTERM") } catch (_) {}
            }
        }
        return { id, status: "STOPPING" }
    }

    const List = () =>
        [...processes.entries()].map(([id, p]) => ({ id, status: p.status, pid: p.pid, debug: p.debug }))

    const GetStatus = (id) => {
        const proc = processes.get(id)
        return proc ? { id, status: proc.status, pid: proc.pid, debug: proc.debug } : { id, status: "NOT_FOUND" }
    }

    const GetLogs = (id) => {
        const proc = processes.get(id)
        return proc ? proc.logs : []
    }

    // Envia dados para o stdin do processo (terminal interativo).
    const WriteToPackage = (id, data) => {
        const proc = processes.get(id)
        if(proc && proc.status === "RUNNING" && proc.child.stdin && proc.child.stdin.writable){
            proc.child.stdin.write(data)
            _append(id, "stdin", data.replace(/\n$/, ""))
            return true
        }
        return false
    }

    // Assina o stream de logs ao vivo de um processo. Retorna uma função de unsubscribe.
    const Subscribe = (id, onLog) => {
        const listener = (entry) => onLog(entry)
        emitter.on(`log:${id}`, listener)
        return () => emitter.off(`log:${id}`, listener)
    }

    return {
        StartPackage,
        StopPackage,
        List,
        GetStatus,
        GetLogs,
        WriteToPackage,
        Subscribe
    }
}

module.exports = InitializeProcessManager
