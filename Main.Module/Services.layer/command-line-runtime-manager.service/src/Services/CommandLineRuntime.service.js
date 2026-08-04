const { join } = require("path")
const { randomUUID } = require("crypto")
const { mkdirSync, existsSync } = require("fs")

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

    /**
     * Executa um COMANDO CRU num terminal — sem pacote, sem boot.json, sem
     * pkg-exec.
     *
     * `RunCommandLinePackage` resolve o executável a partir dos metadados do
     * pacote, e é isso que se quer ao lançar um CLI do ecossistema. Mas há um
     * caso que ele não cobre: rodar um comando de VERIFICAÇÃO declarado por
     * quem chama (`node --test test/store.test.js`) e ficar com a saída e o
     * código de saída. Até aqui, nada no ecossistema entregava as três coisas
     * juntas — comando arbitrário, captura e exit code —, e cada consumidor
     * acabava fazendo o próprio spawn, fora do monitor de instâncias.
     *
     * Reusa o MESMO registro de sessões: `AttachTerminal` já transmite a saída e
     * já emite `{type:"exit", exitCode}` no fim, e `ListTerminals` já guarda o
     * código de saída — a colheita do resultado sai de graça.
     */
    const RunCommand = async ({ command, args, cwd, cols, rows, env } = {}) => {

        if(!command)
            throw new Error("RunCommand: 'command' é obrigatório")
        if(!cwd)
            throw new Error("RunCommand: 'cwd' é obrigatório (o diretório onde o comando roda)")
        // O pty NÃO valida o cwd: com diretório inexistente ele falha lá dentro,
        // de um jeito que chega ao chamador como um código de saída estranho em
        // vez de "esse caminho não existe".
        if(!existsSync(cwd))
            throw new Error(`RunCommand: o diretório '${cwd}' não existe`)

        const commandArgs = Array.isArray(args) ? args.map(String) : []

        const ptyProcess = pty.spawn(command, commandArgs, {
            name: "xterm-color",
            cols: cols || DEFAULT_COLS,
            rows: rows || DEFAULT_ROWS,
            cwd,
            env: { ...process.env, ...(env || {}) }
        })

        // Sem supervisorDir: este processo não é uma instância supervisionada do
        // ecossistema, é uma execução pontual que termina sozinha.
        const terminalId = sessions.Register({
            ptyProcess,
            executableName: command,
            packagePath: cwd
        })

        return { terminalId, command, args: commandArgs, cwd }
    }

    if(onReady)
        onReady()

    return {
        RunCommandLinePackage,
        RunCommand,
        AttachTerminal: sessions.Attach,
        WriteToTerminal: sessions.Write,
        ResizeTerminal: sessions.Resize,
        KillTerminal: sessions.Kill,
        ListTerminals: sessions.List
    }
}

module.exports = CommandLineRuntimeService
