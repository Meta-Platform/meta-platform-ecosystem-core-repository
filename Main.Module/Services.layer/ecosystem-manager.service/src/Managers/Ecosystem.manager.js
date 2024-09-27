const { join } = require('path')
const crypto = require('crypto')

const colors = require("colors")

const ConvertToHashSHA256 = (token) => 
    crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

const FindApplicationTaskByRootPath = (listaTasks, packagePath) => 
    listaTasks.find(({staticParameters}) => staticParameters.rootPath === packagePath)

const ExtractStateByTask = (task) => {
    const {
        taskId,
        objectLoaderType,
        staticParameters,
        status
    } = task
   return {
        taskId,
        objectLoaderType,
        staticParameters,
        status
    }
}

const EcosystemManager = (params) => {

    const {
        registerRepositoryLib,
        environmentHandlerLib,
        dependencyGraphBuilderLib,
        metadataHierarchyHandlerLib,
        resolvePackageNameLib,
        jsonFileUtilitiesLib,
        repositoryManagerService, 
        environmentRuntimeService,
        PKG_CONF_DIRNAME_METADATA,
        ECO_DIRPATH_INSTALL_DATA, 
        REPOS_CONF_FILENAME_REPOS_DATA,
        REPOS_CONF_EXT_GROUP_DIR,
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
        onReady 
    } = params

    const ReadAllPackageMetadata      = dependencyGraphBuilderLib.require("Utils/ReadAllPackageMetadata")
    const BuildMetadataHierarchy      = dependencyGraphBuilderLib.require("BuildMetadataHierarchy")
    const PrepareRepositoriesFileJson = registerRepositoryLib.require("PrepareRepositoriesFileJson")
    const CreateEnvironment           = environmentHandlerLib.require("CreateEnvironment")
    const PrepareDataDir              = environmentHandlerLib.require("PrepareDataDir")
    const ResolvePackageName          = resolvePackageNameLib.require("ResolvePackageName")
    const GetMetadataRootNode         = metadataHierarchyHandlerLib.require("GetMetadataRootNode")
    const WriteObjectToFile           = jsonFileUtilitiesLib.require("WriteObjectToFile")

    const _Start = async () => {
        await PrepareRepositoriesFileJson({
            ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA
        })
        onReady()
    }

    const _GetRootNamespace = (metadataHierarchy) => {
        const dependency = GetMetadataRootNode(metadataHierarchy)
        const { 
            metadata:{
                package:{
                    namespace
                }
            }
        } = dependency
        return namespace
    }

    const _GetEnvironmentName = (metadataHierarchy, packagePath) => {
        const namespace       = _GetRootNamespace(metadataHierarchy)
        const packageName     = ResolvePackageName(namespace)
        const environmentName = `${packageName}-${ConvertToHashSHA256(packagePath)}`
        return environmentName
    }

    const _GetEnvironmentsPath = () => {
        //TODO Parametrizar
        const GLOBAL_RT_ENV_DIRNAME = "environments"
        return join(ECO_DIRPATH_INSTALL_DATA, GLOBAL_RT_ENV_DIRNAME)
    }

    const WriteMetadataGraphFile = async (environmentPath, tree) => 
        await WriteObjectToFile(join(environmentPath, ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA), tree)

    const RunPackage = async ({ packagePath, startupParams }) => {
        try{
            const packageList = await repositoryManagerService.ListPackages()
            const metadataHierarchy = await BuildMetadataHierarchy({
                path: packagePath,
                startupParams,
                packageList,
                REPOS_CONF_EXT_GROUP_DIR,
                PKG_CONF_DIRNAME_METADATA
            })

            const environmentName = _GetEnvironmentName(metadataHierarchy, packagePath)
            const localPath =  _GetEnvironmentsPath()
            const environmentPath = await CreateEnvironment({
                environmentName, 
                localPath
            })

            await PrepareDataDir({ environmentPath, EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES})
            await WriteMetadataGraphFile(environmentPath, metadataHierarchy)
        
            await environmentRuntimeService.ExecuteEnvironment(environmentPath)

            return {}
        }catch(e){

            console.log(e)

            const now = new Date()
            const offset = now.getTimezoneOffset() * 60000
            const localISOTime = (new Date(now - offset)).toISOString()
            const formattedMessage = `${colors.dim(`[${localISOTime}]`)} ${colors.bgCyan.black("[EcosystemManagerService]")} ${colors.inverse(`[RunPackage]`)} ${colors.bgRed("ERROR")} ${e}`
            console.log(formattedMessage)
        }
    }

    //Todo colocar em um webservice
    const ListSupervisedPackages = async () => {
        try{
            const listAllRepositoriesPackage = await repositoryManagerService.ListPackages()
                
            const applicationTasks = environmentRuntimeService.ListApplicationTask() 
    
            const packageStatusPromises = listAllRepositoriesPackage
                .map(async (packageRepositoryParams) => {
                    const packagePath = await repositoryManagerService.GetPackagePath(packageRepositoryParams)
                    const applicationTask = FindApplicationTaskByRootPath(applicationTasks, packagePath)
                    const metadata = await ReadAllPackageMetadata({
                        path: packagePath, 
                        PKG_CONF_DIRNAME_METADATA
                    })
                    const packageInService = !!applicationTask
                    return { 
                        repositoryParams: packageRepositoryParams,
                        hasIcon: await repositoryManagerService.CheckPackageHasIcon(packageRepositoryParams),
                        ...metadata ? { metadata } : {},
                        packageInService,
                        ...packageInService
                            ? { applicationInServiceState: ExtractStateByTask(applicationTask) }
                            : {}
                    }
                })
            return await Promise.all(packageStatusPromises)
        }catch(e){
            console.log(e)
        }
    }

    _Start()

    return {
        RunPackage,
        ListSupervisedPackages,
        GetTaskExecutorEventEmitter: environmentRuntimeService.GetTaskExecutorEventEmitter
    }

}

module.exports = EcosystemManager