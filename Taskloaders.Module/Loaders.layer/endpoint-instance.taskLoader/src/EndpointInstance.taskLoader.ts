const LEVEL_BY_TYPE = { info : "info", success : "message", warning : "warn", error : "error" }

// Fábrica: o taskloader-registry injeta runtimeDeps (TaskStatusTypes,
// CommandChannelEventTypes, SmartRequire, ComputeObjectHash, WebInterfaceBuilder).
// Assim este loader não usa require relativo até o essential/core e pode viver em
// qualquer repositório (destino: ecosystem-core).
const EndpointInstanceTaskLoader = (runtimeDeps: any) => {

    const { TaskStatusTypes, CommandChannelEventTypes } = runtimeDeps

    const StartControllerService              = require("./StartControllerService")(runtimeDeps)
    const StartWebGraphicUserInterfaceService = require("./StartWebGraphicUserInterfaceService")(runtimeDeps)

    return (loaderParams: any, executorChannel: any) => {

        // Carimba a execução: tudo que este loader registrar sai identificado
        // pela instância e pelo ambiente. Ver logging-standard.md.
        const instanceLog = Log.child({
            instanceId     : process.env.META_LAUNCH_ID || null,
            environmentPath: loaderParams.environmentPath || null
        })

        const log = instanceLog.source("EndpointInstance")

        let wasStopped=false
        let isActive=false
        // Handle do build da interface. Enquanto ele existir, existe um compilador
        // webpack (e possivelmente um watcher) vivo neste processo — encerrá-lo é o
        // que devolve essa memória ao sistema quando a task termina.
        let webInterfaceHandle: { Close: () => Promise<void> } | undefined

        const { type } = loaderParams

        const CloseWebInterface = async () => {
            if(!webInterfaceHandle) return
            const handle = webInterfaceHandle
            webInterfaceHandle = undefined
            try { await handle.Close() }
            catch(e){ log.error("falha ao encerrar o build da interface", e) }
        }

        const Start = async () => {
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STARTING)

            try{
                const { url, serverService, needsAuth } = loaderParams

                if(type === "controller")
                    StartControllerService(loaderParams, executorChannel)
                else if(type === "web-graphic-user-interface") {
                    // Era mais uma cópia do formatador de log montada à mão aqui
                    // dentro. O emissor agora delega ao logger global.
                    const { output, Close } = await StartWebGraphicUserInterfaceService({ loaderParams })
                    webInterfaceHandle = { Close }

                    if(!wasStopped){
                        serverService.AddStaticEndpoint({ path:url, staticDir: output, needsAuth })
                        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
                    } else {
                        // A task foi parada enquanto o build corria: o resultado não
                        // será servido, então o compilador que sobrou vai junto.
                        await CloseWebInterface()
                        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
                    }
                } else throw `Tipo de endpoint "${type}" não encontrado`

            }catch(e: any){
                await CloseWebInterface()
                const reason = (e && (e.message || e.toString())) || String(e)
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.FAILURE, reason)
                log.error("falha ao montar o endpoint", e)
            }
        }

        const Stop = () => {
            if(type === "controller" || isActive) {
                CloseWebInterface()
                    .finally(() => executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED))
            }
            else if(type === "web-graphic-user-interface"){
                // Build ainda em curso: sinaliza a parada (o Start em voo lê
                // `wasStopped` e encerra o compilador ao terminar).
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STOPPING)
            } else
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.FAILURE)
        }

        const handleChangeStatus = (status: string) => {
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
