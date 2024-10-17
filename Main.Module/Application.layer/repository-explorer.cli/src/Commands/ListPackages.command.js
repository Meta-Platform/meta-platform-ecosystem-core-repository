const CommandExecutor = require("../Utils/CommandExecutor")

const ListPackagesCommand = async (startupParams) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams

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
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
    
}
module.exports = ListPackagesCommand