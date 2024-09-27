const CommandExecutor = require("../Utils/CommandExecutor")

const StopEnvironmentCommand = async (startupParams, {executionId}) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams

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
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
}

module.exports = StopEnvironmentCommand