const { join } = require("path")
const { spawn } = require("node:child_process")

// Ações de host do eco-panel. A EXECUÇÃO DE PACOTES é delegada ao daemon
// executor-manager (via @/instance-manager-client.lib) — o painel não spawna
// mais `run package`. As ações OpenVSCode/OpenTerminal (abrir editor/terminal
// no host) NÃO são execução de pacote e permanecem como spawn local.
const HostActionsController = (params) => {

    const {
        jsonFileUtilitiesLib,
        notificationHubService,
        instanceManagerClientLib,
        platformApplicationSocketPath
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const { NotifyEvent } = notificationHubService

    const CreateInstanceManagerClient = instanceManagerClientLib.require("CreateInstanceManagerClient")
    const instanceManager = CreateInstanceManagerClient({ platformApplicationSocketPath })

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    // Um pacote é CLI se declara executableName no boot.json.
    const _IsCommandLinePackage = async (packagePath) => {
        try {
            const boot = await ReadJsonFile(join(packagePath, "metadata", "boot.json"))
            const executables = (boot && boot.executables) || []
            return executables.some((item) => item && item.executableName)
        } catch(e) {
            return false
        }
    }

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

    // Executa um pacote DELEGANDO ao daemon.
    const RunPackage = async ({ packagePath }) => {
        if(!(await instanceManager.IsAvailable())){
            const message = "Instance Manager (daemon) indisponível — não foi possível executar."
            _Notify("HostActions.RunPackage", "error", message)
            throw message
        }
        try {
            await instanceManager.RunPackage({ packagePath })
            _Notify("HostActions.RunPackage", "info", `Execução delegada ao daemon: ${packagePath}`)
            return { started: true, packagePath }
        } catch (e) {
            _Notify("HostActions.RunPackage", "error", `Falha ao executar ${packagePath}: ${e.message || e}`)
            throw e
        }
    }

    // "Executar com terminal" (WS). Roteia pelo daemon:
    //  - pacote CLI  → terminal REAL (node-pty) do daemon, com stdout ao vivo
    //  - pacote APP  → execução in-process no daemon (sem stdout por-app):
    //                  reporta apenas status running/closed.
    // Mantém o contrato do webgui: mensagens {type:"status"|"stdout"|"error"}.
    const RunPackageStreaming = async (ws, encodedPackagePath) => {
        const packagePath = decodeURIComponent(encodedPackagePath)

        const _Send = (payload) => { try { ws.send(JSON.stringify(payload)) } catch(e){} }
        const _Close = () => { try { ws.close() } catch(e){} }

        try {
            _Send({ type: "status", status: "starting", message: `Executando via daemon: ${packagePath}` })

            if(!(await instanceManager.IsAvailable())){
                _Send({ type: "error", message: "Instance Manager (daemon) indisponível." })
                _Close()
                return
            }

            if(await _IsCommandLinePackage(packagePath))
                return await _StreamCommandLine(ws, packagePath, _Send, _Close)

            // APP: execução in-process no daemon; sem stream de stdout por-app.
            await instanceManager.RunPackage({ packagePath })
            _Notify("HostActions.RunPackageStreaming", "info", `Execução delegada ao daemon: ${packagePath}`)
            _Send({ type: "status", status: "running", message: "Execução iniciada no daemon (logs centralizados no Instance Manager)." })
            _Send({ type: "status", status: "closed", message: "Solicitação de execução concluída." })
            _Close()
        } catch (e) {
            _Notify("HostActions.RunPackageStreaming", "error", `Falha ao executar ${packagePath}: ${e.message || e}`)
            _Send({ type: "error", message: e.message || String(e) })
            _Close()
        }
    }

    // Executa um CLI no terminal real do daemon e faz a ponte do stream
    // (protocolo do terminal {type:"data"|"exit"} → contrato do webgui
    // {type:"stdout"} / {type:"status", status:"closed"}).
    const _StreamCommandLine = async (ws, packagePath, _Send, _Close) => {
        const { terminalId } = await instanceManager.RunCommandLinePackage({ packagePath })
        _Notify("HostActions.RunPackageStreaming", "info", `Execução com terminal delegada ao daemon: ${packagePath}`)

        const daemonWs = await instanceManager.OpenTerminalStream({ terminalId })

        daemonWs.on("open", () => _Send({ type: "status", status: "running", message: "terminal iniciado" }))
        daemonWs.on("message", (raw) => {
            let m; try { m = JSON.parse(raw.toString()) } catch(e){ return }
            if(m.type === "data")
                _Send({ type: "stdout", message: m.data })
            else if(m.type === "exit"){
                _Send({ type: "status", status: "closed", exitCode: m.exitCode, message: `processo finalizado${m.exitCode !== undefined ? ` com código ${m.exitCode}` : ""}` })
                _Close()
            }
            else if(m.type === "error")
                _Send({ type: "error", message: m.message })
        })
        daemonWs.on("close", () => _Close())
        daemonWs.on("error", (error) => _Send({ type: "error", message: (error && error.message) || String(error) }))

        // Entrada do usuário (se o webgui enviar) → terminal do daemon.
        ws.on && ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw)
                if(msg && msg.type === "input")
                    daemonWs.send(JSON.stringify({ type: "input", data: msg.data }))
            } catch(e){}
        })
        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e){} })
    }

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
        RunPackage,
        RunPackageStreaming,
        OpenVSCode,
        OpenTerminal
    }
}

module.exports = HostActionsController
