const EventEmitter = require('node:events')

const LEVEL_BY_TYPE = { info : "info", success : "message", warning : "warn", error : "error" }

// Fábrica: o taskloader-registry injeta runtimeDeps (TaskStatusTypes,
// CommandChannelEventTypes, SmartRequire, ComputeObjectHash, WebInterfaceBuilder).
// Assim este loader não usa require relativo até o essential/core e pode viver em
// qualquer repositório (destino: ecosystem-core).
const EndpointInstanceTaskLoader = (runtimeDeps) => {

    const { TaskStatusTypes, CommandChannelEventTypes } = runtimeDeps

    const StartControllerService              = require("./StartControllerService")(runtimeDeps)
    const StartWebGraphicUserInterfaceService = require("./StartWebGraphicUserInterfaceService")(runtimeDeps)

    return (loaderParams, executorChannel) => {

        // Carimba a execução: tudo que este loader registrar sai identificado
        // pela instância e pelo ambiente. Ver logging-standard.md.
        const instanceLog = Log.child({
            instanceId     : process.env.META_LAUNCH_ID || null,
            environmentPath: loaderParams.environmentPath || null
        })

        const log = instanceLog.source("EndpointInstance")

        let wasStopped=false
        let isActive=false

        const { type } = loaderParams

        const Start = async () => {
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STARTING)

            try{
                const { url, serverService, needsAuth } = loaderParams

                if(type === "controller")
                    StartControllerService(loaderParams, executorChannel)
                else if(type === "web-graphic-user-interface") {
                    // Era mais uma cópia do formatador de log montada à mão aqui
                    // dentro. O emissor agora delega ao logger global.
                    const loggerEmitter = new EventEmitter()
                    loggerEmitter.on("log", (dataLog) =>
                        instanceLog[LEVEL_BY_TYPE[dataLog.type] || "info"](dataLog.sourceName, dataLog.message))
                    const output = await StartWebGraphicUserInterfaceService({ loaderParams, loggerEmitter })
                    if(!wasStopped){
                        serverService.AddStaticEndpoint({ path:url, staticDir: output, needsAuth })
                        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
                    } else {
                        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
                    }
                } else throw `Tipo de endpoint "${type}" não encontrado`

            }catch(e){
                const reason = (e && (e.message || e.toString())) || String(e)
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.FAILURE, reason)
                log.error("falha ao montar o endpoint", e)
            }
        }

        const Stop = () => {
            if(type === "controller" || isActive) {
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
            }
            else if(type === "web-graphic-user-interface"){
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STOPPING)
            } else
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.FAILURE)
        }

        const handleChangeStatus = (status) => {
            if(status === TaskStatusTypes.STOPPING) wasStopped=true
            if(status === TaskStatusTypes.ACTIVE) isActive=true
        }

        executorChannel.on(CommandChannelEventTypes.START_TASK, Start)
        executorChannel.on(CommandChannelEventTypes.STOP_TASK, Stop)
        executorChannel.on(CommandChannelEventTypes.CHANGE_TASK_STATUS, handleChangeStatus)

        return () => {}
    }
}

module.exports = EndpointInstanceTaskLoader
