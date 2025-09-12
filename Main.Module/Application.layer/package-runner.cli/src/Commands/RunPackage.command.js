const { resolve, join } = require("path")
const crypto = require('crypto')

const colors = require("colors")

const ConvertToHashSHA256 = (token) => 
    crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

const ExecutionDataState = require("../Helpers/ExecutionDataState")
const GetIsolateExecutionParameters = require("../Helpers/GetIsolateExecutionParameters")

const RunPackageCommand = async ({ args, startupParams, params }) => {
    
    const executionState = ExecutionDataState()
    
    const { packagePath } = args

    const {
        installDataDirPath, 
        REPOS_CONF_EXT_MODULE_DIR,
        REPOS_CONF_EXT_LAYER_DIR,
        REPOS_CONF_EXT_GROUP_DIR,
        REPOS_CONF_EXTLIST_PKG_TYPE,
        PKG_CONF_DIRNAME_METADATA,
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
        REPOS_CONF_FILENAME_REPOS_DATA
    } = startupParams

    const {
        repositoryConfigHandlerLib,
        environmentHandlerLib,
        dependencyGraphBuilderLib,
        metadataHierarchyHandlerLib,
        resolvePackageNameLib,
        jsonFileUtilitiesLib,
        repositoryUtilitiesLib,
        applicationInstanceLib,
        installNodejsPackageDependenciesLib,
        nodejsPackageLib,
        serviceInstanceLib,
        endpointInstanceLib,
        commandApplicationLib, 
        taskExecutorLib,
        executionParamsGeneratorLib
    } = params

    const taskLoaders = {
        'install-nodejs-package-dependencies' : installNodejsPackageDependenciesLib.require("InstallNodejsPackageDependencies.taskLoader"),
        'nodejs-package'                      : nodejsPackageLib.require("NodeJSPackage.taskLoader"),
        'command-application'                 : commandApplicationLib.require("CommandApplication.taskLoader"),
        'application-instance'                : applicationInstanceLib.require("ApplicationInstance.taskLoader"),
        'service-instance'                    : serviceInstanceLib.require("ServiceInstance.taskLoader"),
        'endpoint-instance'                   : endpointInstanceLib.require("EndpointInstance.taskLoader")
    }
    const ReadJsonFile                                 = jsonFileUtilitiesLib.require("ReadJsonFile")
    const BuildMetadataHierarchy                       = dependencyGraphBuilderLib.require("BuildMetadataHierarchy")
    const PrepareRepositoriesFileJson                  = repositoryConfigHandlerLib.require("PrepareRepositoriesFileJson")
    const CreateEnvironment                            = environmentHandlerLib.require("CreateEnvironment")
    const PrepareDataDir                               = environmentHandlerLib.require("PrepareDataDir")
    const ResolvePackageName                           = resolvePackageNameLib.require("ResolvePackageName")
    const GetMetadataRootNode                          = metadataHierarchyHandlerLib.require("GetMetadataRootNode")
    const WriteObjectToFile                            = jsonFileUtilitiesLib.require("WriteObjectToFile")
    const ListPackages                                 = repositoryUtilitiesLib.require("ListPackages")
    const TranslateMetadataHierarchyForExecutionParams = executionParamsGeneratorLib.require("TranslateMetadataHierarchyForExecutionParams")
    const TaskExecutor                                 = taskExecutorLib.require("TaskExecutor")
    
    const taskExecutor = TaskExecutor({
        taskLoaders
    })

    const absolutInstallDataDirPath = ConvertPathToAbsolutPath(installDataDirPath)

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
        return join(absolutInstallDataDirPath, GLOBAL_RT_ENV_DIRNAME)
    }

     const _GetMetadataHierarchy = async (environmentPath) => {
        return await ReadJsonFile(join(environmentPath, ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA))
    }

    const _WriteMetadataGraphFile = async (environmentPath, tree) => 
        await WriteObjectToFile(join(environmentPath, ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA), tree)

    const _Execute = async (environmentPath, executionParams) => {
        const taskIdList = taskExecutor.CreateTasks(executionParams)
        await WriteObjectToFile(join(environmentPath, "execution-params.json"), executionParams)
        const executionId = executionState.RegisterExecution(environmentPath, taskIdList)
        return executionId
    }
    
    try{
        await PrepareRepositoriesFileJson({
            installDataDirPath:absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA
        })
        const absolutePackagePath = resolve(process.cwd(), packagePath)
        const startupParamsPath = resolve(absolutePackagePath, PKG_CONF_DIRNAME_METADATA, "startup-params.json")
        const startupParams = await ReadJsonFile(startupParamsPath)
        const packageList = await ListPackages({
            installDataDirPath: absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR,
            REPOS_CONF_EXT_LAYER_DIR,
            REPOS_CONF_EXT_GROUP_DIR,
            REPOS_CONF_EXTLIST_PKG_TYPE
        })
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
        await _WriteMetadataGraphFile(environmentPath, metadataHierarchy)
    
        if(!executionState.CheckIfExecutionCanBeRegistered(environmentPath)){
            const metadataHierarchy = await _GetMetadataHierarchy(environmentPath)
            const applicationExecutionParams = TranslateMetadataHierarchyForExecutionParams({
                metadataHierarchy, 
                environmentPath,
                EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES
            })
            const isolatedExecutionParameters = GetIsolateExecutionParameters(applicationExecutionParams, {environmentPath})
            const executionId = await _Execute(environmentPath, isolatedExecutionParameters)
            return executionId
        }else {
            throw `O ambiente ${environmentPath} já esta em execução`
        }

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

module.exports = RunPackageCommand
