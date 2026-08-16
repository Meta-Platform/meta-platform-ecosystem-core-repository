const PackageChoiceTerminalView = require("../Utils/PackageChoiceTerminalView")
const MountPackagePath = require("../Utils/MountPackagePath")
const ExecutePackage = require("../Utils/ExecutePackage")

const RunPackageCommand = async ({ args, startupParams, params }: any) => {

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

        const CommandFunction = async ({ APIs }: any) => {
            const API = APIs
            .PlatformMainApplicationInstance
            .RepositoryManager
            const listPackages = await API.ListPackages()

            const packageChoices = listPackages
            // `package` é palavra reservada em modo estrito, e todo módulo
            // TypeScript é estrito. Renomeado; a montagem é a mesma.
            .map((packageInfo: any) => {
                const { 
                    packageName, 
                    parentGroup,
                    ext,
                    layerName,
                    moduleName,
                    namespaceRepo
                } = packageInfo
                return {
                    namespace: `${namespaceRepo}.${moduleName}.${layerName}${parentGroup ? `.${parentGroup}`: ""}.${packageName}.${ext}`,
                    path: MountPackagePath(REPOS_CONF_EXT_GROUP_DIR, packageInfo)
                }
            })
            
            const namespace = await PackageChoiceTerminalView(packageChoices)
            const chosenItem = packageChoices.find((item: any) => item.namespace === namespace) 
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