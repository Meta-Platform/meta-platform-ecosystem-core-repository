const { resolve } = require("path")

const CommandExecutor = require("../Utils/CommandExecutor")

const ExecuteEnvironmentCommand = async ({ args, startupParams }) => {

    const { path } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const CommandFunction = async ({ APIs }) => {
        const absolutePath = resolve(process.cwd(), path)
        const API = APIs
            .PlatformMainApplicationInstance
            .EnvironmentRuntime
    
        const executionId = await API.ExecuteEnvironment({ environmentPath:absolutePath })

        const socket = await API.ExecutionStatusChange({executionId})

        socket.onopen = () => 
            console.log(`Começo do monitoramento de eventos da execution ${executionId}`)

        socket.onmessage = function(event) {
            const { data } = event
            const message = JSON.parse(data)
            console.log(message)
            if(message.status === "RUNNING"){
                socket.close()
            }
        }

        socket.onclose = () => 
            console.log(`Fim do monitoramento de eventos da execution ${executionId}`)
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}
module.exports = ExecuteEnvironmentCommand