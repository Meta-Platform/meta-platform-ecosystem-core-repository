const path = require("path")
const EventEmitter = require('node:events')

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()  

const InstancesSupervisorController = (params) => {

    const eventEmitter  = new EventEmitter()

    const {
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        instanceMonitoringManager,
        supervisorLib,
        ecosystemdataHandlerService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    let supervisorSocketsDirPath = undefined
    
    const _InitSupervisorSocketsDirPath = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        supervisorSocketsDirPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)
    }

    _InitSupervisorSocketsDirPath()

    instanceMonitoringManager.AddChangeSocketListListener((socketFileNameList) => {
        eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    })

    const CreateCommunicationInterface = supervisorLib.require("CreateCommunicationInterface")

    const ListInstanceTasks = async (socketFileName) => {
        const socketFilePath = path.resolve(supervisorSocketsDirPath, socketFileName)
        const daemonClient = await CreateCommunicationInterface(socketFilePath)
        const taskList = await daemonClient.ListTasks()
        return taskList
    }

    const GetTaskInformation = async ({socketFileName, taskId}) => {
        const socketFilePath = path.resolve(supervisorSocketsDirPath, socketFileName)
        const daemonClient = await CreateCommunicationInterface(socketFilePath)
        const task = await daemonClient.GetTask(taskId)
        return task
    }

    const InstanceSocketFileListChange = (ws) => {
        eventEmitter
        .on(SOCKET_FILE_LIST_CHANGE_EVENT, (socketFileNameList) => {
            try{
                ws.send(JSON.stringify(socketFileNameList))
            }catch(e){
                console.log(e)
            }
        })
    }

    const ShowInstanceStatus = async (socketFileName) => {
        const socketFilePath = path.resolve(supervisorSocketsDirPath, socketFileName)
        const daemonClient = await CreateCommunicationInterface(socketFilePath)
        const status = await daemonClient.GetStatus()
        return status
    }

    const controllerServiceObject = {
        controllerName : "InstancesSupervisorController",
        ListSockets: instanceMonitoringManager.GetMonitoredSocketFilePaths,
        Overview: instanceMonitoringManager.GetOverview,
        ShowInstanceStatus,
        ListInstanceTasks,
        KillInstance: (socketFileName) => {},
        GetTaskInformation,
        InstanceSocketFileListChange
    }

    return Object.freeze(controllerServiceObject)
    
}

module.exports = InstancesSupervisorController