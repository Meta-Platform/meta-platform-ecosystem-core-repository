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

    const _Start = async () => {

        const socketsDirPath = await _ConfigSocketsDirPath()
        const socketFileNames = await ListSocketFilesName(socketsDirPath)
        socketFileNames.forEach((socketFileName: string) => InitializeSocketMonitoring(_GetSocketFilePath(socketFileName)))

        const __HandlerSocketDirectoryChange = _CreateHandlerSocketDirectoryChange()

        WatchSocketDirectory({
            directoryPath: supervisorSocketsDirPath, 
            onChangeSocketFileList: __HandlerSocketDirectoryChange
        })
        onReady()

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
        
    _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringManager
