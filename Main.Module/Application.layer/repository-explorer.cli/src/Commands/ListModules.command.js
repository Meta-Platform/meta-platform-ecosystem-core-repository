const CommandExecutor = require("../Utils/CommandExecutor")

const ListModulesCommand = async ({startupParams}) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

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