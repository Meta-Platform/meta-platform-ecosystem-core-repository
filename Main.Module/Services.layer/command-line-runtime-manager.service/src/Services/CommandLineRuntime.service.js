const { join } = require("path")
const { randomUUID } = require("crypto")
const { mkdirSync } = require("fs")

const SmartRequire = require("../SmartRequire")
const CreateTerminalSessionState = require("../Helpers/CreateTerminalSessionState")

const pty = SmartRequire("node-pty")

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

// Serviço de execução de pacotes CLI com terminal real (PTY).
//
// Diferente de APP/serviço/endpoint/DESKTOP — que o daemon executa in-process —
// um pacote CLI é interativo e precisa de um terminal. Este serviço spawna o
// `pkg-exec` do CLI dentro de um PTY (node-pty), reproduzindo a mesma invocação
// que o wrapper `execute-command-line-application` faz, e distribui o I/O do
// terminal para os consumidores (o painel, via WebSocket).
const CommandLineRuntimeService = (params) => {

    const {
        jsonFileUtilitiesLib,
        ecosystemDataPath,
        configurationsDirName,
        npmDependenciesDirName,
        ecosystemDefaultsFileName,
        supervisorSocketsDirName,
        metadataDirName,
        startupParamsFileName,
        bootFileName,
        onReady
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const sessions = CreateTerminalSessionState()

    // Lê o executableName declarado no boot.json do pacote CLI.
    const _ResolveExecutableName = async (packagePath) => {
        const boot = await ReadJsonFile(join(packagePath, metadataDirName, bootFileName))
        const executables = (boot && boot.executables) || []
        const executable = executables.find((item) => item && item.executableName)

        if(!executable)
            throw new Error(`O pacote em '${packagePath}' não declara um executableName (não é um pacote CLI executável)`)

        return executable.executableName
    }

    // Cria um socket de supervisão para a instância CLI num SUBDIRETÓRIO com
    // nome gerado (UUID) dentro de supervisor-sockets — evita colisão quando o
    // mesmo CLI é executado mais de uma vez. Retorna o diretório (para limpeza)
    // e o caminho do socket. A instância vira supervisionável (aparece no
    // instance-supervisor).
    const _CreateSupervisorSocket = (executableName) => {
        const instanceDir = join(ecosystemDataPath, supervisorSocketsDirName, randomUUID())
        mkdirSync(instanceDir, { recursive: true })
        return {
            supervisorDir: instanceDir,
            supervisorSocketPath: join(instanceDir, `${executableName}.sock`)
        }
    }

    // Monta os argumentos do pkg-exec — equivalente ao que
    // GetCommandLineApplicationExecutionContent gera para o wrapper `run`.
    const _BuildPkgExecArgs = ({ packagePath, executableName, commandLineArgs, supervisorSocketPath }) => {
        const ecosystemDefaultFilePath = join(ecosystemDataPath, configurationsDirName, ecosystemDefaultsFileName)
        const nodejsDependenciesPath   = join(ecosystemDataPath, npmDependenciesDirName)
        const startupJsonFilePath      = join(packagePath, metadataDirName, startupParamsFileName)

        const args = [
            "--package", packagePath,
            "--startupJson", startupJsonFilePath,
            "--ecosystemDefault", ecosystemDefaultFilePath,
            "--ecosystemData", ecosystemDataPath,
            "--nodejsProjectDependencies", nodejsDependenciesPath,
            "--executableName", executableName,
            "--commandLineArgs", commandLineArgs || ""
        ]

        if(supervisorSocketPath)
            args.push("--supervisorSocket", `unix:${supervisorSocketPath}`)

        return args
    }

    // Inicia um pacote CLI num terminal novo. Retorna o id da sessão de
    // terminal, que o painel usa para abrir o stream bidirecional.
    const RunCommandLinePackage = async ({ packagePath, commandLineArgs, cols, rows } = {}) => {

        if(!packagePath)
            throw new Error("RunCommandLinePackage: 'packagePath' é obrigatório")

        const executableName = await _ResolveExecutableName(packagePath)

        const { supervisorDir, supervisorSocketPath } = _CreateSupervisorSocket(executableName)
        const args = _BuildPkgExecArgs({ packagePath, executableName, commandLineArgs, supervisorSocketPath })

        const ptyProcess = pty.spawn("pkg-exec", args, {
            name: "xterm-color",
            cols: cols || DEFAULT_COLS,
            rows: rows || DEFAULT_ROWS,
            cwd: packagePath,
            env: process.env
        })

        const terminalId = sessions.Register({ ptyProcess, executableName, packagePath, supervisorDir })

        return { terminalId, executableName, supervisorSocketPath }
    }

    if(onReady)
        onReady()

    return {
        RunCommandLinePackage,
        AttachTerminal: sessions.Attach,
        WriteToTerminal: sessions.Write,
        ResizeTerminal: sessions.Resize,
        KillTerminal: sessions.Kill,
        ListTerminals: sessions.List
    }
}

module.exports = CommandLineRuntimeService
