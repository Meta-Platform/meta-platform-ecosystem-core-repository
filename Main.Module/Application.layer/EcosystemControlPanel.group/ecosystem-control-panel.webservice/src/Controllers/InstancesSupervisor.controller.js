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

    // Streaming de log do processo via socket: conecta no LogStreaming do
    // package-executor e repassa cada mensagem para o websocket do navegador.
    const LogStreaming = (ws, monitoringStateKey) => {
        let logStreaming
        const _safeSend = (payload) => { try { ws.send(JSON.stringify(payload)) } catch(e){} }
        const _cleanup = () => {
            try {
                if(!logStreaming) return
                if(typeof logStreaming.cancel === "function") logStreaming.cancel()
                else if(typeof logStreaming.destroy === "function") logStreaming.destroy()
            } catch(e){}
        }
        try {
            logStreaming = instanceMonitoringManager.GetLogStreaming(monitoringStateKey)
            logStreaming.on("data",  (logData) => _safeSend(logData))
            logStreaming.on("error", (error)  => _safeSend({ message: `[erro] ${(error && error.message) || error}` }))
            logStreaming.on("end",   ()        => _safeSend({ message: "[stream encerrado]" }))
        } catch(e) {
            _safeSend({ message: `[erro] ${(e && e.message) || e}` })
        }
        ws.on && ws.on("close", _cleanup)
    }

    const controllerServiceObject = {
        controllerName         : "InstancesSupervisorController",
        ListMonitoringKeys     : instanceMonitoringManager.GetMonitoringKeysReady,
        Overview               : instanceMonitoringManager.GetOverview,
        ListInstanceTasks      : instanceMonitoringManager.ListInstanceTasks,
        GetTaskInformation     : instanceMonitoringManager.GetTaskInformation,
        GetStartupArguments    : instanceMonitoringManager.GetStartupArguments,
        GetProcessInformation  : instanceMonitoringManager.GetProcessInformation,
        KillInstance           : instanceMonitoringManager.KillInstance,
        InstanceOverviewChange,
        LogStreaming
    }
    return Object.freeze(controllerServiceObject)
    
}

module.exports = InstancesSupervisorController