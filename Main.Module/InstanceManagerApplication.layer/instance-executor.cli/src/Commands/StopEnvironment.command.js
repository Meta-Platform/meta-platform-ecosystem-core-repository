const StopEnvironmentCommand = async ({ args, startupParams, params }) => {

    const { executionId } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .EnvironmentRuntime

        try{
            await API.StopExecution({executionId:executionId})

            const socket = await API.ExecutionStatusChange({executionId})

            socket.onopen = () => 
                console.log(`Começo do monitoramento de eventos da execution ${executionId}`)

            socket.onmessage = function(event) {
                const { data } = event
                const message = JSON.parse(data)
                console.log(message)
                if(message.status === "TERMINATED"){
                    socket.close()
                }
            }

            socket.onclose = () => 
                console.log(`Fim do monitoramento de eventos da execution ${executionId}`)
        } catch(e){
            console.log(e)
        }
    }

	await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = StopEnvironmentCommand