const MonitorCommand = async ({ startupParams, params }) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .TaskExecutorMachine

        try{
            const socket = await API.TaskStatusChange()

            socket.onopen = () => Log.message("Monitor", "Conectado ao Task Executor Machine!")

            socket.onmessage = function(event) {
                const {data} = event
                const message = JSON.parse(data)
                Log.debug("Monitor", message)
            }

            socket.onclose = () => {
                Log.message("Monitor", "onClose")
            }

            
        } catch(e){
            Log.error("Monitor", e)
        }
    }

	await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = MonitorCommand