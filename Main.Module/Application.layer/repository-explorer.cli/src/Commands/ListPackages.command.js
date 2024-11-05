const ListPackagesCommand = async ({ startupParams, params }) => {

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
        const listPackages = await API.ListPackages()
        console.log("=========== Registered Packages ===========")
        listPackages
            .forEach(package => {
                const { 
                    packageName, 
                    parentGroup, 
                    ext, 
                    layerName, 
                    moduleName, 
                    namespaceRepo 
                } = package
                console.log(`\x1b[2m${namespaceRepo}.${moduleName}.${layerName}\x1b[0m${parentGroup ? `.\x1b[3m${parentGroup}\x1b[0m`: ""}.\x1b[1m${packageName}\x1b[0m.${ext}`)
            })

        console.log("\n")
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
    
}
module.exports = ListPackagesCommand