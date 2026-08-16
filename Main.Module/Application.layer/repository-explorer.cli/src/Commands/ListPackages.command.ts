const ListPackagesCommand = async ({ startupParams, params }: any) => {

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
        const listPackages = await API.ListPackages()
        Log.message("ListPackages", "=========== Registered Packages ===========")
        listPackages
            // `package` é palavra reservada em modo estrito; renomeado.
            .forEach((packageInfo: any) => {
                const { 
                    packageName, 
                    parentGroup, 
                    ext, 
                    layerName, 
                    moduleName, 
                    namespaceRepo 
                } = packageInfo
                Log.message("ListPackages", `\x1b[2m${namespaceRepo}.${moduleName}.${layerName}\x1b[0m${parentGroup ? `.\x1b[3m${parentGroup}\x1b[0m`: ""}.\x1b[1m${packageName}\x1b[0m.${ext}`)
            })

        Log.message("ListPackages", "\n")
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
    
}
module.exports = ListPackagesCommand