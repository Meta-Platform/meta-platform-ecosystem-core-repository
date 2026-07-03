const EventEmitter = require('node:events')
const { resolve } = require("path")
const colors = require("colors")

const AreArraysEqual = require("../Utils/AreArraysEqual")

const CreateInstanceSocketHandlerManager = require("../Helpers/CreateInstanceSocketHandlerManager")

const InstanceMonitoringManager = (params) => {

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
    let supervisorSocketsDirPath = undefined

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
        
        let socketFileNameList = []

        const __ChangeList = (newList) => {
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

        const __HandlerSocketDirectoryChange = (newSocketFileNameList) => {
            if(!AreArraysEqual(newSocketFileNameList, socketFileNameList)){
                __ChangeList(newSocketFileNameList)
                newSocketFileNameList
                .forEach((socketFileName) => TryInitializeSocketMonitoring(_GetSocketFilePath(socketFileName)))
            }
        }
        
        return __HandlerSocketDirectoryChange
    }

    const _GetSocketFilePath = (socketFileName) => resolve(supervisorSocketsDirPath, socketFileName)

    const _Start = async () => {

        const socketsDirPath = await _ConfigSocketsDirPath()
        const socketFileNames = await ListSocketFilesName(socketsDirPath)
        socketFileNames.forEach((socketFileName) => InitializeSocketMonitoring(_GetSocketFilePath(socketFileName)))

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

    const _GetConnectionClient = (monitoringStateKey) => {
        const socketMonitoringState = GetSocketMonitoringState(monitoringStateKey)
        if(!socketMonitoringState) return undefined
        if(socketMonitoringState.GetCommunicationStatus() !== "CONNECTED") return undefined
        const communicationClient = socketMonitoringState.GetCommunicationClient()
        return communicationClient
    }

    const _GetUnavailableFallback = (fname) => {
        if(fname === "ListTasks") return []
        if(fname === "GetTask") return undefined
        if(fname === "GetStartupArguments") return {}
        if(fname === "GetProcessInformation") return {}
        if(fname === "KillInstance") return false
        return undefined
    }

    const _CallRPC = async (monitoringStateKey, fname, fArgs) => {
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

    const ListInstanceTasks     = async (monitoringStateKey) =>           await _CallRPC(monitoringStateKey, "ListTasks")
    const GetTaskInformation    = async ({monitoringStateKey, taskId}) => await _CallRPC(monitoringStateKey, "GetTask", taskId)
    const GetStartupArguments   = async (monitoringStateKey) =>           await _CallRPC(monitoringStateKey, "GetStartupArguments")
    const GetProcessInformation = async (monitoringStateKey) =>           await _CallRPC(monitoringStateKey, "GetProcessInformation")
    const KillInstance          = async (monitoringStateKey) =>           await _CallRPC(monitoringStateKey, "KillInstance")

    // Retorna o stream de log do processo (package-executor) via socket.
    // O client expõe GetLogStreaming() (RPC LogStreaming do daemon) que emite
    // eventos 'data'/'error'. Quem consome deve cancelar/destruir ao encerrar.
    const GetLogStreaming = (monitoringStateKey) => {
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
