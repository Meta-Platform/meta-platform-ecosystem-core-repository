const CommandExecutor = require("../Utils/CommandExecutor")

const RegisterRepositoryCommand = async (startupParams, cmdParams) => {  

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
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
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = RegisterRepositoryCommand