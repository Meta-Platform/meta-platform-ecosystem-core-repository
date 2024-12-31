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
            socketFileNameList = newList
            NotifyEvent({
                origin: "InstanceMonitoringManager",
                type:"message",
                content: `A lista de sockets foi atualizada para ${colors.bold(newList.join(", "))}`
            })
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
        const communicationClient = socketMonitoringState.GetCommunicationClient()
        return communicationClient
    }

    const _CallRPC = async (monitoringStateKey, fname, fArgs) => {
        const communicationClient = _GetConnectionClient(monitoringStateKey)
        const responseData = await communicationClient[fname](fArgs)
        return responseData
    }

    const ListInstanceTasks = async (monitoringStateKey) => {
        const taskList = await _CallRPC(monitoringStateKey, "ListTasks")
        return taskList
    }

    const GetTaskInformation = async ({monitoringStateKey, taskId}) => {
        const task =  await _CallRPC(monitoringStateKey, "GetTask", taskId)
        return task
    }

    const GetStartupArguments = async (monitoringStateKey) => {
        const startupArguments =  await _CallRPC(monitoringStateKey, "GetStartupArguments")
        return startupArguments
    }
    
    const monitoringObject = {
        OverviewChangeListener,
        GetMonitoringKeysReady,
        GetOverview: Overview,
        ListInstanceTasks,
        GetTaskInformation,
        GetStartupArguments
    }
        
    _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringManager