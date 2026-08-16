const StopEnvironmentCommand = async ({ args, startupParams, params }: any) => {

    const { executionId } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const CommandFunction = async ({ APIs }: any) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .EnvironmentRuntime

        try{
            await API.StopExecution({executionId:executionId})

            const socket = await API.ExecutionStatusChange({executionId})

            socket.onopen = () => 
                Log.message("StopEnvironment", `Começo do monitoramento de eventos da execution ${executionId}`)

            socket.onmessage = function(event: any) {
                const { data } = event
                const message = JSON.parse(data)
                Log.debug("StopEnvironment", message)
                if(message.status === "TERMINATED"){
                    socket.close()
                }
            }

            socket.onclose = () => 
                Log.message("StopEnvironment", `Fim do monitoramento de eventos da execution ${executionId}`)
        } catch(e: any){
            Log.error("StopEnvironment", e)
        }
    }

	await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = StopEnvironmentCommand