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
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = MonitorCommand