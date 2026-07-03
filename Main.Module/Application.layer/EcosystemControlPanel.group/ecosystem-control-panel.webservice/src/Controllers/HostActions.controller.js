const path = require("path")
const { spawn } = require("node:child_process")

const HostActionsController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        notificationHubService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const { NotifyEvent } = notificationHubService

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    const _GetExecutablesDirPath = async () => {
        const ecosystemDefaults = await ReadJsonFile(
            path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath))
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR)
    }

    // Dispara um processo desacoplado (não bloqueia o servidor nem morre com ele).
    const _SpawnDetached = (command, args, options = {}) =>
        new Promise((resolve, reject) => {
            try {
                const child = spawn(command, args, { detached: true, stdio: "ignore", ...options })
                child.on("error", (err) => reject(err))
                // dá um tempo curto para capturar erro de "command not found"
                setTimeout(() => { child.unref(); resolve() }, 150)
            } catch (e) {
                reject(e)
            }
        })

    // Executa um pacote pela CLI `run package <path>` (gera nova instância).
    const RunPackage = async ({ packagePath }) => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const env = { ...process.env, PATH: `${executablesDirPath}:${process.env.PATH}` }
        try {
            await _SpawnDetached(path.resolve(executablesDirPath, "run"), ["package", packagePath], {
                cwd: ecosystemdataHandlerService.GetEcosystemDataPath(),
                env
            })
            _Notify("HostActions.RunPackage", "info", `Executando pacote: ${packagePath}`)
            return { started: true, packagePath }
        } catch (e) {
            _Notify("HostActions.RunPackage", "error", `Falha ao executar ${packagePath}: ${e.message || e}`)
            throw e
        }
    }

    const RunPackageStreaming = async (ws, encodedPackagePath) => {
        const packagePath = decodeURIComponent(encodedPackagePath)
        const executablesDirPath = await _GetExecutablesDirPath()
        const env = { ...process.env, PATH: `${executablesDirPath}:${process.env.PATH}` }
        const commandPath = path.resolve(executablesDirPath, "run")
        let child

        const _Send = (payload) => {
            try { ws.send(JSON.stringify(payload)) } catch(e) {}
        }

        const _Close = () => {
            try { ws.close() } catch(e) {}
        }

        try {
            _Send({ type: "status", status: "starting", message: `run package ${packagePath}` })
            child = spawn(commandPath, ["package", packagePath], {
                cwd: ecosystemdataHandlerService.GetEcosystemDataPath(),
                env
            })

            child.stdout.on("data", (chunk) => _Send({ type: "stdout", message: chunk.toString() }))
            child.stderr.on("data", (chunk) => _Send({ type: "stderr", message: chunk.toString() }))
            child.on("error", (error) => {
                _Notify("HostActions.RunPackageStreaming", "error", `Falha ao executar ${packagePath}: ${error.message || error}`)
                _Send({ type: "error", message: error.message || String(error) })
                _Close()
            })
            child.on("spawn", () => {
                _Notify("HostActions.RunPackageStreaming", "info", `Executando pacote com terminal: ${packagePath}`)
                _Send({ type: "status", status: "running", message: "processo iniciado" })
            })
            child.on("close", (code, signal) => {
                _Send({ type: "status", status: "closed", exitCode: code, signal, message: `processo finalizado${code !== null ? ` com código ${code}` : ""}${signal ? ` (${signal})` : ""}` })
                _Close()
            })
        } catch(e) {
            _Notify("HostActions.RunPackageStreaming", "error", `Falha ao executar ${packagePath}: ${e.message || e}`)
            _Send({ type: "error", message: e.message || String(e) })
            _Close()
        }

        ws.on && ws.on("close", () => {
            if(child && !child.killed)
                child.kill()
        })
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
