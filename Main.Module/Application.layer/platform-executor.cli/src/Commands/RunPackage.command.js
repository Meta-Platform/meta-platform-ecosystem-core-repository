const CommandExecutor = require("../Utils/CommandExecutor")
const PackageChoiceTerminalView = require("../Utils/PackageChoiceTerminalView")
const MountPackagePath = require("../Utils/MountPackagePath")
const ExecutePackage = require("../Utils/ExecutePackage")

const RunPackageCommand = async (startupParams, {path}) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT,
        REPOS_CONF_EXT_GROUP_DIR
    } = startupParams

    if(path){
        await ExecutePackage(startupParams, path)
    } else {

        const CommandFunction = async ({ APIs }) => {
            const API = APIs
            .PlatformMainApplicationInstance
            .RepositoryManager
            const listPackages = await API.ListPackages()

            const packageChoices = listPackages
            .map(package => {
                const { 
                    packageName, 
                    parentGroup,
                    ext,
                    layerName,
                    moduleName,
                    namespaceRepo
                } = package
                return {
                    namespace: `${namespaceRepo}.${moduleName}.${layerName}${parentGroup ? `.${parentGroup}`: ""}.${packageName}.${ext}`,
                    path: MountPackagePath(REPOS_CONF_EXT_GROUP_DIR, package)
                }
            })
            
            const namespace = await PackageChoiceTerminalView(packageChoices)
            const chosenItem = packageChoices.find(item => item.namespace === namespace) 
            await ExecutePackage(startupParams, chosenItem.path)
        }

        await CommandExecutor({
            serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
            mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
            CommandFunction
        })
        
    }
}
module.exports = RunPackageCommand