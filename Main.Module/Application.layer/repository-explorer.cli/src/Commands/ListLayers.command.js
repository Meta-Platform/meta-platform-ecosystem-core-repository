const CommandExecutor = require("../Utils/CommandExecutor")

const ListLayersCommand = async (startupParams) => {
    
    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const CommandFunction = async ({ APIs }) => {
        const API = APIs
        .PlatformMainApplicationInstance
        .RepositoryManager
        const listLayers = await API.ListLayers()
        console.log("=========== Registered Layers ===========")
        listLayers
            .forEach(module => {
                const { moduleName, namespaceRepo, layerName } = module
                console.log(`\x1b[2m${namespaceRepo}.${moduleName}.\x1b[0m\x1b[1m${layerName}\x1b[0m`)
            })

        console.log("\n")
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ListLayersCommand