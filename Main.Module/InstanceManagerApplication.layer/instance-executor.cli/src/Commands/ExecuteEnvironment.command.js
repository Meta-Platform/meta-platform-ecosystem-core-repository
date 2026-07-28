const { resolve } = require("path")

const ExecuteEnvironmentCommand = async ({ args, startupParams, params }) => {

    const { path } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const CommandFunction = async ({ APIs }) => {
        const absolutePath = resolve(process.cwd(), path)
        const API = APIs
            .PlatformMainApplicationInstance
            .EnvironmentRuntime
    
        const executionId = await API.ExecuteEnvironment({ environmentPath:absolutePath })

        const socket = await API.ExecutionStatusChange({executionId})

        socket.onopen = () => 
            Log.message("ExecuteEnvironment", `Começo do monitoramento de eventos da execution ${executionId}`)

        socket.onmessage = function(event) {
            const { data } = event
            const message = JSON.parse(data)
            Log.debug("ExecuteEnvironment", message)
            if(message.status === "RUNNING"){
                socket.close()
            }
        }

        socket.onclose = () => 
            Log.message("ExecuteEnvironment", `Fim do monitoramento de eventos da execution ${executionId}`)
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}
module.exports = ExecuteEnvironmentCommand