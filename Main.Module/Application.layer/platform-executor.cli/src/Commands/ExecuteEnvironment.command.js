const { resolve } = require("path")

const CommandExecutor = require("../Utils/CommandExecutor")

const ExecuteEnvironmentCommand = async (startupParams, {path}) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
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
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
}
module.exports = ExecuteEnvironmentCommand