const { resolve } = require("path")

const PackageChoiceTerminalView = require("../Utils/PackageChoiceTerminalView")
const MountPackagePath = require("../Utils/MountPackagePath")
const ExecutePackage = require("../Utils/ExecutePackage")

const RunPackageCommand = async ({ args, startupParams, params }) => {

    const { path } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint,
        REPOS_CONF_EXT_GROUP_DIR
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

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
            serverResourceEndpointPath: httpServerManagerEndpoint,
            mainApplicationSocketPath: platformApplicationSocketPath,
            CommandFunction
        })
        
    }
}
module.exports = RunPackageCommand