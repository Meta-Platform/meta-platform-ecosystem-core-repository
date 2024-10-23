const CommandExecutor = require("../Utils/CommandExecutor")

const MonitorCommand = async ({ startupParams }) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams

    const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .TaskExecutorMachine

        try{
            const socket = await API.TaskStatusChange()

            socket.onopen = () => console.log("Conectado ao Task Executor Machine!")

            socket.onmessage = function(event) {
                const {data} = event
                const message = JSON.parse(data)
                console.log(message)
            }

            socket.onclose = () => {
                console.log("onClose")
            }

            
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

module.exports = MonitorCommand