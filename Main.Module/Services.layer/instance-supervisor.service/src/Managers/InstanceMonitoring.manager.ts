const EventEmitter = require('node:events') as typeof import('node:events')
const { resolve } = require("path") as typeof import("path")
const colors = require("colors") as any

const AreArraysEqual = require("../Utils/AreArraysEqual") as (array1: any[], array2: any[]) => boolean

const CreateInstanceSocketHandlerManager = require("../Helpers/CreateInstanceSocketHandlerManager") as (options: { helpers: any }) => any

const InstanceMonitoringManager = (params: any) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        supervisorLib,
        notificationHubService,
        onReady 
    } = params

    const WatchSocketDirectory         = supervisorLib.require("WatchSocketDirectory")
    const ListSocketFilesName          = supervisorLib.require("ListSocketFilesName")
    const CreateCommunicationInterface = supervisorLib.require("CreateCommunicationInterface")
    const ReadJsonFile                 = jsonFileUtilitiesLib.require("ReadJsonFile")

    const { NotifyEvent } = notificationHubService

    const ecosystemDefaultFilePath = resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
    let supervisorSocketsDirPath: string | undefined = undefined

    const {
        Overview,
        TryInitializeSocketMonitoring,
        InitializeSocketMonitoring,
        GetMonitoringKeysReady,
        GetSocketMonitoringState,
        AddEventListener
    } = CreateInstanceSocketHandlerManager({
        helpers:{
            CreateCommunicationInterface,
            NotifyEvent
        }
    })

    const _CreateHandlerSocketDirectoryChange = () => {
        
        let socketFileNameList: string[] = []

        const __ChangeList = (newList: string[]) => {
            const addedSockets = newList.filter((socketFileName) => !socketFileNameList.includes(socketFileName))
            const removedSockets = socketFileNameList.filter((socketFileName) => !newList.includes(socketFileName))
            socketFileNameList = newList
            NotifyEvent({
                origin: "InstanceMonitoringManager",
                type:"message",
                content: `A lista de sockets foi atualizada para ${colors.bold(newList.join(", "))}`
            })
            addedSockets.forEach((socketFileName) => NotifyEvent({
                origin: "InstanceMonitoringManager",
                type: "socket",
                content: {
                    event: "created",
                    title: "Novo socket detectado",
                    message: `Socket ${socketFileName} foi detectado e será monitorado.`,
                    socketFileName
                }
            }))
            removedSockets.forEach((socketFileName) => NotifyEvent({
                origin: "InstanceMonitoringManager",
                type: "socket",
                content: {
                    event: "removed",
                    title: "Socket removido",
                    message: `Socket ${socketFileName} saiu da lista de supervisão.`,
                    socketFileName
                }
            }))
        }

        const __HandlerSocketDirectoryChange = (newSocketFileNameList: string[]) => {
            if(!AreArraysEqual(newSocketFileNameList, socketFileNameList)){
                __ChangeList(newSocketFileNameList)
                newSocketFileNameList
                .forEach((socketFileName: string) => TryInitializeSocketMonitoring(_GetSocketFilePath(socketFileName)))
            }
        }
        
        return __HandlerSocketDirectoryChange
    }

    const _GetSocketFilePath = (socketFileName: string) => resolve(supervisorSocketsDirPath!, socketFileName)

    // `onReady` é o sinal que o host espera para dar a montagem por concluída.
    // Ele tem de sair UMA vez e SEMPRE — inclusive quando a partida falha, senão
    // o host fica esperando para sempre um sinal que não vem mais. O guarda
    // existe porque o caminho de erro também precisa emiti-lo, e não dá para
    // saber daqui se o caminho feliz já passou por ele.
    let sinalizouPronto = false
    const _SinalizarPronto = () => {
        if(sinalizouPronto) return
        sinalizouPronto = true
        onReady()
    }

    // A observação do diretório é a ÚNICA parte disto que depende de um recurso
    // do sistema operacional (inotify, no Linux) e, portanto, a única que falha
    // por motivo ambiental: com o teto de watches da máquina estourado, `watch`
    // devolve EMFILE.
    //
    // A promessa de WatchSocketDirectory nunca se resolve com sucesso — o laço
    // dela é infinito. Ela só SETTLA em falha, o que faz deste `catch` o único
    // sinal existente de que a observação caiu. Sem ele o erro virava
    // UnhandledPromiseRejection no stderr, e o produto seguia como se estivesse
    // observando: a lista de instâncias congelava no que havia no boot, sem nada
    // em lugar nenhum dizendo o contrário.
    //
    // DEGRADAR, e não derrubar a montagem: a varredura inicial já monitorou os
    // sockets existentes, e todo o RPC do painel (ListTasks, KillInstance,
    // GetLogStreaming...) continua valendo sobre eles. Derrubar o serviço
    // tiraria também o que ainda funciona. O que se perde é estreito e preciso —
    // perceber instância que ENTRA ou SAI daqui em diante —, e é exatamente isso
    // que a mensagem precisa dizer, porque uma lista congelada é indistinguível
    // de "não há nada rodando" para quem olha o painel.
    const _ObservacaoInterrompida = (e: any) => {
        const motivo = e && e.message ? e.message : String(e)
        Log.error("InstanceMonitoring.manager",
            `A observação de ${supervisorSocketsDirPath} foi interrompida: instâncias que iniciarem ou terminarem a partir de agora NÃO vão aparecer nem sair do monitor enquanto este serviço não for reiniciado. O que já estava em execução segue monitorado. Motivo: ${motivo}`, e)
        NotifyEvent({
            origin: "InstanceMonitoringManager",
            type: "message",
            content: `${colors.bold("Monitoramento degradado")}: a lista de instâncias parou de se atualizar sozinha (${motivo}). O que já estava em execução continua visível; instâncias novas não vão aparecer até reiniciar o supervisor.`
        })
    }

    const _Start = async () => {

        const socketsDirPath = await _ConfigSocketsDirPath()
        const socketFileNames = await ListSocketFilesName(socketsDirPath)
        socketFileNames.forEach((socketFileName: string) => InitializeSocketMonitoring(_GetSocketFilePath(socketFileName)))

        const __HandlerSocketDirectoryChange = _CreateHandlerSocketDirectoryChange()

        WatchSocketDirectory({
            directoryPath: supervisorSocketsDirPath,
            onChangeSocketFileList: __HandlerSocketDirectoryChange
        }).catch(_ObservacaoInterrompida)
        _SinalizarPronto()

    }

    // Falhar ANTES do watcher é outra história: sem ler o ecosystem-defaults ou
    // sem varrer o diretório não há monitoramento NENHUM, nem dos sockets que já
    // existem. Continua não sendo motivo para derrubar o host — o resto do painel
    // não depende disto —, mas aqui a perda é total e a mensagem tem de dizer
    // isso, não repetir o texto da degradação parcial.
    const _PartidaFalhou = (e: any) => {
        const motivo = e && e.message ? e.message : String(e)
        Log.error("InstanceMonitoring.manager",
            `O monitoramento de instâncias não subiu: NENHUMA instância será monitorada por este serviço (o painel vai mostrar a lista vazia mesmo com processos rodando). Motivo: ${motivo}`, e)
        NotifyEvent({
            origin: "InstanceMonitoringManager",
            type: "message",
            content: `${colors.bold("Monitoramento indisponível")}: não foi possível iniciar a supervisão de instâncias (${motivo}). A lista vazia NÃO significa que não há nada em execução.`
        })
        _SinalizarPronto()
    }

    const _ConfigSocketsDirPath = async () => {
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        const socketsDirPath = resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)
        supervisorSocketsDirPath = socketsDirPath
        return socketsDirPath
    }

    const OverviewChangeListener = AddEventListener

    const _GetConnectionClient = (monitoringStateKey: string) => {
        const socketMonitoringState = GetSocketMonitoringState(monitoringStateKey)
        if(!socketMonitoringState) return undefined
        if(socketMonitoringState.GetCommunicationStatus() !== "CONNECTED") return undefined
        const communicationClient = socketMonitoringState.GetCommunicationClient()
        return communicationClient
    }

    const _GetUnavailableFallback = (fname: string): any => {
        if(fname === "ListTasks") return []
        if(fname === "GetTask") return undefined
        if(fname === "GetStartupArguments") return {}
        if(fname === "GetProcessInformation") return {}
        if(fname === "KillInstance") return false
        return undefined
    }

    const _CallRPC = async (monitoringStateKey: string, fname: string, fArgs?: any) => {
        const communicationClient = _GetConnectionClient(monitoringStateKey)
        if(!communicationClient || typeof communicationClient[fname] !== "function") {
            return _GetUnavailableFallback(fname)
        }
        try {
            const responseData = await communicationClient[fname](fArgs)
            return responseData
        } catch(e) {
            return _GetUnavailableFallback(fname)
        }
    }

    const ListInstanceTasks     = async (monitoringStateKey: string) =>           await _CallRPC(monitoringStateKey, "ListTasks")
    const GetTaskInformation    = async ({monitoringStateKey, taskId}: { monitoringStateKey: string, taskId: string }) => await _CallRPC(monitoringStateKey, "GetTask", taskId)
    const GetStartupArguments   = async (monitoringStateKey: string) =>           await _CallRPC(monitoringStateKey, "GetStartupArguments")
    const GetProcessInformation = async (monitoringStateKey: string) =>           await _CallRPC(monitoringStateKey, "GetProcessInformation")
    const KillInstance          = async (monitoringStateKey: string) =>           await _CallRPC(monitoringStateKey, "KillInstance")

    // Retorna o stream de log do processo (package-executor) via socket.
    // O client expõe GetLogStreaming() (RPC LogStreaming do daemon) que emite
    // eventos 'data'/'error'. Quem consome deve cancelar/destruir ao encerrar.
    const GetLogStreaming = (monitoringStateKey: string) => {
        const communicationClient = _GetConnectionClient(monitoringStateKey)
        return communicationClient.GetLogStreaming()
    }

    const monitoringObject = {
        OverviewChangeListener,
        GetMonitoringKeysReady,
        GetOverview: Overview,
        ListInstanceTasks,
        GetTaskInformation,
        GetStartupArguments,
        GetProcessInformation,
        GetLogStreaming,
        KillInstance
    }
        
    _Start().catch(_PartidaFalhou)

    return monitoringObject

}

module.exports = InstanceMonitoringManager
