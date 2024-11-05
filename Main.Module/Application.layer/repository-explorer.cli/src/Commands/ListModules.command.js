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
        console.log("=========== Registered Modules ===========")
        listModules
            .forEach(module => {
                const { moduleName, namespaceRepo } = module
                console.log(`\x1b[2m${namespaceRepo}.\x1b[0m\x1b[1m${moduleName}\x1b[0m`)
            })
        console.log("\n")
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}
module.exports = ListModulesCommand