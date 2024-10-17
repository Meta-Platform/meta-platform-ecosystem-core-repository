const CommandExecutor = require("../Utils/CommandExecutor")

const RegisterRepositoryCommand = async (startupParams, cmdParams) => {  

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams

    const {
        namespace,
        path
    } = cmdParams
	
	const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .RepositoryManager

		API.RegisterRepository({
			namespace, 
			path
		})
    }

	await CommandExecutor({
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
}

module.exports = RegisterRepositoryCommand