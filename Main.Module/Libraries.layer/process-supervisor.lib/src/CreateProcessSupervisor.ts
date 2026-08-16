const { spawn } = require("node:child_process") as typeof import("node:child_process")

/** O que o supervisor conta a quem o observa, sem decidir nada por ele. */
type SupervisorEvent =
    | { type: "starting", command: string, args: string[] }
    | { type: "error", message: string }
    | { type: "exited", code: number | null, signal: NodeJS.Signals | null }
    | { type: "restarting", inMs: number }

// Supervisor de processo com AUTO-RESTART: mantém um processo vivo, reiniciando-o
// sempre que ele terminar. Usa backoff exponencial entre tentativas, resetando o
// backoff quando o processo se mostra estável (rodou por tempo suficiente).
//
// Preenche a lacuna do ecossistema (não há keep-alive/respawn): o padrão de
// spawn segue o package-process-manager.lib; a novidade é o re-spawn no `exit`.
const CreateProcessSupervisor = ({
    command,
    args = [],
    env = process.env,
    cwd,
    minBackoffMs = 500,
    maxBackoffMs = 15000,
    stableAfterMs = 10000,
    beforeSpawn = () => {},
    onEvent = () => {}
}: {
    command: string
    args?: string[]
    env?: NodeJS.ProcessEnv
    cwd?: string
    minBackoffMs?: number
    maxBackoffMs?: number
    stableAfterMs?: number
    beforeSpawn?: () => void
    onEvent?: (event: SupervisorEvent) => void
}) => {

    let child: import("node:child_process").ChildProcess | null = null
    let stopped = false
    let backoff = minBackoffMs
    let restartTimer: NodeJS.Timeout | null = null

    const _SpawnOnce = () => {
        const startedAt = Date.now()
        try { beforeSpawn() } catch(e: any){ onEvent({ type: "error", message: (e && e.message) || String(e) }) }
        onEvent({ type: "starting", command, args })

        child = spawn(command, args, { cwd, env, stdio: "inherit" })

        child.on("error", (error) =>
            onEvent({ type: "error", message: (error && error.message) || String(error) }))

        child.on("exit", (code, signal) => {
            child = null
            onEvent({ type: "exited", code, signal })

            if(stopped) return

            // Se rodou tempo suficiente, considera-se que estava saudável: reseta o backoff.
            if(Date.now() - startedAt >= stableAfterMs)
                backoff = minBackoffMs

            const delay = backoff
            onEvent({ type: "restarting", inMs: delay })
            restartTimer = setTimeout(() => {
                _SpawnOnce()
                backoff = Math.min(backoff * 2, maxBackoffMs)
            }, delay)
        })
    }

    const Start = () => {
        stopped = false
        _SpawnOnce()

        // Encerramento limpo: mata o filho e para de reiniciar.
        const shutdown = () => { Stop(); process.exit(0) }
        process.on("SIGINT", shutdown)
        process.on("SIGTERM", shutdown)
    }

    const Stop = () => {
        stopped = true
        if(restartTimer) clearTimeout(restartTimer)
        if(child && !child.killed){ try { child.kill("SIGTERM") } catch(e){} }
    }

    const IsRunning = () => Boolean(child)

    return { Start, Stop, IsRunning }
}

module.exports = CreateProcessSupervisor
