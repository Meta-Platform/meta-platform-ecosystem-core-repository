
const MountAPIs = require("../../mount-api.lib/src/MountAPIs")

// Nome do servidor exposto pelo daemon `executor-manager`
// (ecosystem-instance-manager.app), definido em metadata/startup-params.json.
const DEFAULT_SERVER_NAME = "PlatformMainApplicationInstance"

// Endpoint padrão de status do server-manager, usado para descobrir a
// superfície de APIs publicada pelo daemon.
const DEFAULT_SERVER_STATUS_ENDPOINT = "/server-manager/status"

// Controller sem o qual o daemon não serve para nada (é quem executa pacotes).
// Enquanto ele não aparece no status, o daemon ainda está subindo: o HTTP
// server já responde, mas os controllers ainda não foram registrados.
const REQUIRED_CONTROLLER = "EcosystemManager"

// Cliente reutilizável do Instance Manager (daemon `executor-manager`).
//
// Centraliza a comunicação com o daemon de execução: os painéis (my-desktop,
// eco-panel, instance-executor-control-panel) usam este cliente em vez de
// spawnar `run package` diretamente. A conexão é feita por HTTP sobre o
// Unix socket do daemon, reaproveitando o mesmo mecanismo do CLI `executor`
// (mount-api.lib), de forma que a superfície é descoberta dinamicamente a
// partir dos `.api.json` publicados pelo daemon.
//
// Parâmetros:
//  - platformApplicationSocketPath: caminho do Unix socket do daemon
//        (ex.: <EcosystemData>/sockets/ecosystem-instance-manager.app.sock)
//  - httpServerManagerEndpoint: endpoint de status do server-manager
//  - serverName: nome do servidor publicado pelo daemon
const CreateInstanceManagerClient = ({
    platformApplicationSocketPath,
    httpServerManagerEndpoint = DEFAULT_SERVER_STATUS_ENDPOINT,
    serverName = DEFAULT_SERVER_NAME
}) => {

    if(!platformApplicationSocketPath)
        throw new Error("CreateInstanceManagerClient: 'platformApplicationSocketPath' é obrigatório")

    // Cache da montagem das APIs. Montar exige uma consulta ao status do
    // daemon; uma vez montadas, as funções são stateless (cada chamada abre
    // uma nova requisição no mesmo socket), então podem ser reutilizadas
    // mesmo que o daemon reinicie. Em caso de falha, o cache é invalidado
    // para permitir nova tentativa depois (ex.: quando a supervisão religar
    // o daemon).
    let apisPromise

    const _Connect = async () => {
        const APIs = await MountAPIs({
            serverResourceEndpointPath: httpServerManagerEndpoint,
            mainApplicationSocketPath: platformApplicationSocketPath
        })

        if(!APIs || !APIs[serverName])
            throw new Error(`Instance Manager daemon indisponível em ${platformApplicationSocketPath}`)

        // Superfície incompleta = daemon ainda inicializando. Tratar como
        // indisponível (e não cachear) é o que permite ao chamador tentar de
        // novo e ao usuário receber a mensagem correta de "daemon não pronto".
        if(!APIs[serverName][REQUIRED_CONTROLLER])
            throw new Error(`Instance Manager daemon ainda inicializando em ${platformApplicationSocketPath}`)

        return APIs[serverName]
    }

    const _GetAPIs = () => {
        if(!apisPromise)
            apisPromise = _Connect().catch((error) => {
                apisPromise = undefined
                throw error
            })
        return apisPromise
    }

    const _FindMethod = async (controllerName, methodName) => {
        const controllers = await _GetAPIs()
        const controller = controllers[controllerName]
        const method = controller && controller[methodName]

        return (typeof method === "function") ? method : undefined
    }

    // O daemon publica `/server-manager/status` assim que o HTTP server sobe,
    // ANTES de registrar os controllers. Uma montagem feita nessa janela
    // enxerga o servidor mas não o controller, e ficaria cacheada para sempre
    // (o cache só era invalidado em erro de chamada, não em método ausente).
    // Por isso: método ausente invalida o cache e força UMA remontagem — se o
    // daemon já terminou de subir, a segunda tentativa acha o método.
    const _ResolveMethod = async (controllerName, methodName) => {
        const method = await _FindMethod(controllerName, methodName)
        if(method)
            return method

        apisPromise = undefined

        const methodAfterRemount = await _FindMethod(controllerName, methodName)
        if(methodAfterRemount)
            return methodAfterRemount

        apisPromise = undefined
        throw new Error(`Método ${controllerName}.${methodName} não disponível no Instance Manager daemon`)
    }

    // Chamada HTTP (request/response). Em caso de erro invalida o cache das
    // APIs, forçando remontagem na próxima chamada.
    const _Call = async (controllerName, methodName, args = {}) => {
        const method = await _ResolveMethod(controllerName, methodName)
        try {
            return await method(args)
        } catch(error) {
            apisPromise = undefined
            throw error
        }
    }

    // Abertura de canal WebSocket (streams). Retorna o socket já aberto;
    // o consumidor é responsável por assinar eventos e fechá-lo.
    const _OpenStream = async (controllerName, methodName, args = {}) => {
        const method = await _ResolveMethod(controllerName, methodName)
        return method(args)
    }

    return {

        // ---- Disponibilidade ------------------------------------------------

        // Retorna true se o daemon está de pé e respondendo.
        IsAvailable: async () => {
            try {
                await _GetAPIs()
                return true
            } catch(error) {
                return false
            }
        },

        // ---- EcosystemManager (execução de pacotes) -------------------------

        // Executa um pacote a partir do seu caminho absoluto. `launchedBy`
        // identifica quem pediu (my-desktop, instance-executor-panel…) e fica
        // registrado junto da instância. Devolve `{ instanceId }` — a identidade
        // desta execução, necessária para encerrá-la depois.
        RunPackage: ({ packagePath, startupParams, launchedBy } = {}) =>
            _Call("EcosystemManager", "RunPackage", { packagePath, startupParams, launchedBy }),

        // Encerra TODAS as instâncias de um pacote pelo seu caminho.
        StopPackage: ({ packagePath } = {}) =>
            _Call("EcosystemManager", "StopPackage", { packagePath }),

        // Encerra UMA instância pelo seu id (um pacote desktop pode estar aberto
        // várias vezes; é assim que se fecha a janela certa).
        StopInstance: ({ instanceId } = {}) =>
            _Call("EcosystemManager", "StopInstance", { instanceId }),

        // Lista os pacotes supervisionados pelo daemon.
        ListPackages: () =>
            _Call("EcosystemManager", "ListPackages"),

        // Stream de mudanças na lista de pacotes (WebSocket).
        OpenPackageListStream: () =>
            _OpenStream("EcosystemManager", "PackageList"),

        // Instâncias que o daemon colocou no ar (apps in-process e desktop).
        ListInstances: () =>
            _Call("EcosystemManager", "ListInstances"),

        // Stream das instâncias lançadas pelo daemon (WebSocket).
        OpenInstanceListStream: () =>
            _OpenStream("EcosystemManager", "InstanceList"),

        // Tarefas internas de UMA instância (o daemon consulta o socket do
        // processo dela — usado para instâncias desktop, que rodam separadas).
        ListInstanceTasks: ({ instanceId } = {}) =>
            _Call("EcosystemManager", "ListInstanceTasks", { instanceId }),

        // Stream (WS) das tarefas internas de uma instância — push, sem polling.
        OpenInstanceTaskStream: ({ instanceId } = {}) =>
            _OpenStream("EcosystemManager", "InstanceTaskStream", { instanceId }),

        // Encerra tarefas internas de uma instância desktop.
        StopInstanceTasks: ({ instanceId, taskIds } = {}) =>
            _Call("EcosystemManager", "StopInstanceTasks", { instanceId, taskIds }),

        // Stream de progresso de lançamento de aplicações (abrindo → build →
        // aberto), consumido pelos painéis para refletir no ícone.
        OpenLaunchProgressStream: () =>
            _OpenStream("EcosystemManager", "LaunchProgressStream"),

        // ---- TaskExecutorMachine (tarefas) ----------------------------------

        // Lista todas as tarefas do task-executor compartilhado do daemon.
        ListTasks: () =>
            _Call("TaskExecutorMachine", "ListTasks"),

        // Detalha uma tarefa pelo id.
        GetTask: ({ taskId } = {}) =>
            _Call("TaskExecutorMachine", "GetTask", { taskId }),

        // Cria tarefas a partir de parâmetros de execução já resolvidos.
        CreateTasks: ({ executionParams } = {}) =>
            _Call("TaskExecutorMachine", "CreateTasks", { executionParams }),

        // Encerra tarefas pelos seus ids.
        StopTasks: ({ taskIds } = {}) =>
            _Call("TaskExecutorMachine", "StopTasks", { taskIds }),

        // Stream de mudança de status das tarefas (WebSocket).
        OpenTaskStatusStream: () =>
            _OpenStream("TaskExecutorMachine", "TaskStatusChange"),

        // ---- EnvironmentRuntime (ambientes em execução) ---------------------

        // Executa um ambiente a partir do seu caminho.
        ExecuteEnvironment: ({ environmentPath } = {}) =>
            _Call("EnvironmentRuntime", "ExecuteEnvironment", { environmentPath }),

        // Lista os ambientes em execução.
        ListRunningEnvironments: () =>
            _Call("EnvironmentRuntime", "ListRunningEnvironments"),

        // Encerra uma execução pelo seu id.
        StopExecution: ({ executionId } = {}) =>
            _Call("EnvironmentRuntime", "StopExecution", { executionId }),

        // Stream de mudança de status de uma execução (WebSocket).
        OpenExecutionStatusStream: ({ executionId } = {}) =>
            _OpenStream("EnvironmentRuntime", "ExecutionStatusChange", { executionId }),

        // ---- CommandLineRuntime (pacotes CLI com terminal/PTY) --------------

        // Inicia um pacote CLI num terminal (PTY) e retorna { terminalId, executableName }.
        RunCommandLinePackage: ({ packagePath, commandLineArgs, cols, rows } = {}) =>
            _Call("CommandLineRuntime", "RunPackage", { packagePath, commandLineArgs, cols, rows }),

        // Lista as sessões de terminal abertas.
        ListTerminals: () =>
            _Call("CommandLineRuntime", "List"),

        // Encerra uma sessão de terminal (mata o processo do CLI).
        KillTerminal: ({ terminalId } = {}) =>
            _Call("CommandLineRuntime", "Kill", { terminalId }),

        // Abre o canal WebSocket bidirecional de um terminal (I/O + resize).
        OpenTerminalStream: ({ terminalId } = {}) =>
            _OpenStream("CommandLineRuntime", "TerminalStream", { terminalId })
    }
}

module.exports = CreateInstanceManagerClient
