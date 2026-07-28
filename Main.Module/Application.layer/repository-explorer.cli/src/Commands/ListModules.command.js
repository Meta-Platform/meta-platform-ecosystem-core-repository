const ListModulesCommand = async ({ startupParams, params }) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const CommandFunction = async ({ APIs }) => {
        const API = APIs
        .PlatformMainApplicationInstance
        .RepositoryManager
        const listModules = await API.ListModules()
        Log.message("ListModules", "=========== Registered Modules ===========")
        listModules
            .forEach(module => {
                const { moduleName, namespaceRepo } = module
                Log.message("ListModules", `\x1b[2m${namespaceRepo}.\x1b[0m\x1b[1m${moduleName}\x1b[0m`)
            })
        Log.message("ListModules", "\n")
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}
module.exports = ListModulesCommand