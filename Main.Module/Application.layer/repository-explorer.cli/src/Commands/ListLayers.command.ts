const ListLayersCommand = async ({ startupParams, params }: any) => {
    
    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const CommandFunction = async ({ APIs }: any) => {
        const API = APIs
        .PlatformMainApplicationInstance
        .RepositoryManager
        const listLayers = await API.ListLayers()
        Log.message("ListLayers", "=========== Registered Layers ===========")
        listLayers
            .forEach((module: any) => {
                const { moduleName, namespaceRepo, layerName } = module
                Log.message("ListLayers", `\x1b[2m${namespaceRepo}.${moduleName}.\x1b[0m\x1b[1m${layerName}\x1b[0m`)
            })

        Log.message("ListLayers", "\n")
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ListLayersCommand