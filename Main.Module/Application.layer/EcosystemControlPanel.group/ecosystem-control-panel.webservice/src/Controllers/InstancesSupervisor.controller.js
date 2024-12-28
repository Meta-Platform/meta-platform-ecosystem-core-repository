const path = require("path")
const EventEmitter = require('node:events')

const INSTANCE_OVERVIEW_CHANGE_EVENT = Symbol()  

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

    instanceMonitoringManager.OverviewChangeListener(() => eventEmitter.emit(INSTANCE_OVERVIEW_CHANGE_EVENT))

    const InstanceOverviewChange = (ws) => {
        eventEmitter
        .on(INSTANCE_OVERVIEW_CHANGE_EVENT, () => {
            try{
                const overviewData = instanceMonitoringManager.GetOverview()
                ws.send(JSON.stringify(overviewData))
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
        InstanceOverviewChange
    }

    return Object.freeze(controllerServiceObject)
    
}

module.exports = InstancesSupervisorController