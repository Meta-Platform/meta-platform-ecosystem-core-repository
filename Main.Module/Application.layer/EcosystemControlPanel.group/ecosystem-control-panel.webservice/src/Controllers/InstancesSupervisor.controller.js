const path = require("path")
const EventEmitter = require('node:events')

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()  

const InstancesSupervisorController = (params) => {

    const eventEmitter  = new EventEmitter()

    const {
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        instanceMonitoringManager,
        ecosystemdataHandlerService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    
    const _InitSupervisorSocketsDirPath = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        supervisorSocketsDirPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)
    }

    _InitSupervisorSocketsDirPath()

    instanceMonitoringManager.AddChangeSocketListListener((socketFileNameList) => {
        eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    })

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

    const controllerServiceObject = {
        controllerName : "InstancesSupervisorController",
        ListMonitoringKeys: instanceMonitoringManager.GetMonitoringKeys,
        Overview: instanceMonitoringManager.GetOverview,
        ListInstanceTasks: instanceMonitoringManager.ListInstanceTasks,
        GetTaskInformation: instanceMonitoringManager.GetTaskInformation,
        KillInstance: (socketFileName) => {},
        InstanceSocketFileListChange
    }

    return Object.freeze(controllerServiceObject)
    
}

module.exports = InstancesSupervisorController