const EventEmitter = require('node:events')

const GetColorLogByType = (type) => {
    switch(type){
        case "info":
            return "bgBlue"
        case "warning":
            return "bgYellow"
        case "error":
            return "bgRed"
        default:
            return "bgGray"
    }
  }

// Fábrica: o taskloader-registry injeta runtimeDeps (TaskStatusTypes,
// CommandChannelEventTypes, SmartRequire, ComputeObjectHash, WebInterfaceBuilder).
// Assim este loader não usa require relativo até o essential/core e pode viver em
// qualquer repositório (destino: ecosystem-core).
const EndpointInstanceTaskLoader = (runtimeDeps) => {

    const { TaskStatusTypes, CommandChannelEventTypes, SmartRequire } = runtimeDeps
    const colors = SmartRequire("colors")

    const StartControllerService              = require("./StartControllerService")(runtimeDeps)
    const StartWebGraphicUserInterfaceService = require("./StartWebGraphicUserInterfaceService")(runtimeDeps)

    return (loaderParams, executorChannel) => {

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
                    const loggerEmitter = new EventEmitter()
                    loggerEmitter.on("log", (dataLog) => {
                        const {
                          sourceName,
                          type,
                          message
                        } = dataLog

                        const color = GetColorLogByType(type)

                        const now = new Date()
                        const offset = now.getTimezoneOffset() * 60000
                        const localISOTime = (new Date(now - offset)).toISOString()

                        const typeFormatted = type.padEnd(7)

                        const formattedMessage = `${colors.dim(`[${localISOTime}]`)} ${colors.bgCyan.black("[EndpointInstanceObjectLoader]")} ${colors[color](`[${typeFormatted}]`)} ${colors.inverse(`[${sourceName}]`)} ${message}`
                        console.log(formattedMessage)
                    })
                    const output = await StartWebGraphicUserInterfaceService({ loaderParams, loggerEmitter })
                    if(!wasStopped){
                        serverService.AddStaticEndpoint({ path:url, staticDir: output, needsAuth })
                        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
                    } else {
                        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
                    }
                } else throw `Tipo de endpoint "${type}" não encontrado`

            }catch(e){
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.FAILURE)
                console.error(e)
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
