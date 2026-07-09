const { spawn } = require("node:child_process")

// Ações de host do eco-panel: abrir editor/terminal no host a partir de um
// caminho. NÃO executa pacotes — quem executa (e mostra o terminal de execução)
// é o Instance Executor Panel, que fala direto com o daemon executor-manager.
const HostActionsController = (params) => {

    const {
        notificationHubService
    } = params

    const { NotifyEvent } = notificationHubService

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    // spawn desacoplado — usado APENAS para abrir editor/terminal no host.
    const _SpawnDetached = (command, args, options = {}) =>
        new Promise((resolve, reject) => {
            try {
                const child = spawn(command, args, { detached: true, stdio: "ignore", ...options })
                child.on("error", (err) => reject(err))
                setTimeout(() => { child.unref(); resolve() }, 150)
            } catch (e) {
                reject(e)
            }
        })

    const OpenVSCode = async ({ targetPath }) => {
        try {
            await _SpawnDetached("code", [targetPath], { env: process.env })
            _Notify("HostActions.OpenVSCode", "info", `Abrindo VSCode em ${targetPath}`)
            return { opened: true }
        } catch (e) {
            _Notify("HostActions.OpenVSCode", "error", `Não foi possível abrir o VSCode (comando 'code' disponível no PATH?): ${e.message || e}`)
            throw e
        }
    }

    const OpenTerminal = async ({ targetPath }) => {
        const candidates = [
            ["x-terminal-emulator", [`--working-directory=${targetPath}`]],
            ["gnome-terminal", [`--working-directory=${targetPath}`]],
            ["konsole", ["--workdir", targetPath]],
            ["xfce4-terminal", [`--working-directory=${targetPath}`]],
            ["xterm", ["-e", `cd '${targetPath}' && exec bash`]]
        ]
        for (const [command, args] of candidates) {
            try {
                await _SpawnDetached(command, args, { env: process.env })
                _Notify("HostActions.OpenTerminal", "info", `Abrindo terminal em ${targetPath} (${command})`)
                return { opened: true, emulator: command }
            } catch (e) {
                // tenta o próximo emulador
            }
        }
        _Notify("HostActions.OpenTerminal", "error", `Nenhum emulador de terminal encontrado no host.`)
        throw "Nenhum emulador de terminal disponível no host"
    }

    return {
        controllerName : "HostActionsController",
        OpenVSCode,
        OpenTerminal
    }
}

module.exports = HostActionsController
