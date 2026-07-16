const { join } = require("path")
const crypto = require('crypto')
const os = require('os')
const colors = require("colors")
const EventEmitter = require('events')

const ConvertToHashSHA256 = (token) => 
    crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

const ExecutionDataState = require("../Helpers/ExecutionDataState")
const GetIsolateExecutionParameters = require("../Helpers/GetIsolateExecutionParameters")
const PrintDataLog = require("../Helpers/PrintDataLog")
const GetColorLogByStatus = require("../Helpers/GetColorLogByStatus")
const StartInstanceTaskSocketServer = require("../Helpers/StartInstanceTaskSocketServer")
const ReportInstanceTasksToDaemon = require("../Helpers/ReportInstanceTasksToDaemon")

 const GetFormattedMessage = (taskId, status, objectLoaderType) => {
    return `[${taskId}] [${objectLoaderType}] ${colors[GetColorLogByStatus(status)](status)}`
}

const ConvertPathToAbsolutPath = (_path) => join(_path)
    .replace('~', os.homedir())

const RunPackageCommand = async ({ args, startupParams, params }) => {
    
    const executionState = ExecutionDataState()
    
    const { packagePath } = args

    const {
        installDataDirPath,
        ecosystemDefaultsFileRelativePath
    } = startupParams

    const {
        repositoryConfigHandlerLib,
        environmentHandlerLib,
        dependencyGraphBuilderLib,
        metadataHierarchyHandlerLib,
        resolvePackageNameLib,
        jsonFileUtilitiesLib,
        ecosystemDefaultsHandlerLib,
        repositoryUtilitiesLib,
        taskExecutorLib,
        executionParamsGeneratorLib,
        utilitiesLib,
        serverManagerServiceLib,
        serverManagerWebserviceLib
    } = params

    // Descoberta dinâmica: monta o mapa de object loaders a partir dos
    // taskloaders.json dos repositórios instalados (em vez de um mapa hard-coded).
    // O taskloader-registry.lib é carregado por require() direto (a partir do
    // installationPath do EssentialRepo) — NÃO via handler de pacote: o
    // handler.require faz require.main.require + manipula NODE_PATH, o que
    // desalinha o carregamento dos loaders e quebra a montagem de params.
    const _repositoriesData = JSON.parse(require("fs").readFileSync(
        join(ConvertPathToAbsolutPath(installDataDirPath), "repositories.json"), { encoding: "utf8" }))
    const _CreateTaskLoaders = require(join(
        _repositoriesData.EssentialRepo.installationPath,
        "Taskloaders.Module/Registry.layer/taskloader-registry.lib/src/CreateTaskLoaders"))
    const taskLoaders = _CreateTaskLoaders({ repositoriesData: _repositoriesData })
    const ReadJsonFile                                 = jsonFileUtilitiesLib.require("ReadJsonFile")
    const GetEcosystemDefaults                         = ecosystemDefaultsHandlerLib.require("Get")
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

    const loggerEmitter = new EventEmitter()
    loggerEmitter.on("log", (dataLog) => PrintDataLog(dataLog))

    taskExecutor
        .AddTaskStatusListener(({taskId, status, objectLoaderType}) => {
            loggerEmitter && loggerEmitter.emit("log", {
                sourceName: "TaskExecutor",
                type: "info",
                message: GetFormattedMessage(taskId, status, objectLoaderType)
            })
        })

    // Quando o daemon lança este processo como uma INSTÂNCIA (desktop), ele passa
    // META_INSTANCE_TASK_SOCKET no env. Expomos então o task-executor deste
    // processo num Unix socket, para o daemon consultar as tarefas internas desta
    // instância. É best-effort: qualquer falha aqui não pode afetar a execução.
    const instanceTaskSocketPath = process.env.META_INSTANCE_TASK_SOCKET
    if(instanceTaskSocketPath && utilitiesLib && serverManagerServiceLib && serverManagerWebserviceLib){
        const FormatTaskForOutput = utilitiesLib.require("FormatTaskForOutput")
        const GetTaskInformation  = utilitiesLib.require("GetTaskInformation")

        // Adaptador sobre o MESMO taskExecutor que roda as tarefas — o
        // `controllerName` é o que o mount-api usa para localizar o serviço.
        // O socket server-manager segue servindo o StopTasks (daemon → filho).
        const taskExecutorMachineService = {
            controllerName : "TaskExecutorMachineController",
            ListTasks : () => taskExecutor.ListTasks().map((task) => FormatTaskForOutput(task)),
            GetTask   : (taskId) => GetTaskInformation(taskExecutor.GetTask(taskId)),
            StopTasks : (taskIds) => taskExecutor.StopTasks(taskIds)
        }

        StartInstanceTaskSocketServer({
            socketPath: instanceTaskSocketPath,
            serverName: process.env.META_INSTANCE_TASK_SERVER_NAME || "InstanceTaskExecutor",
            taskExecutorMachineService,
            serverManagerServiceLib,
            serverManagerWebserviceLib
        }).catch((e) =>
            console.error(`${colors.bgRed("[InstanceTaskSocket]")} falha ao abrir socket de tarefas: ${e.message}`))

        // PUSH: reporta a lista de tarefas ao daemon a cada mudança de status (com
        // debounce leve para não inundar durante o boot). O daemon faz stream ao
        // painel por WebSocket — sem polling. Reusa o socket do daemon
        // (META_LAUNCH_PROGRESS_SOCKET) e o instanceId (META_LAUNCH_ID).
        const daemonSocketPath = process.env.META_LAUNCH_PROGRESS_SOCKET
        const instanceId       = process.env.META_LAUNCH_ID
        if(daemonSocketPath && instanceId){
            let reportTimer
            const _reportTasks = () => {
                clearTimeout(reportTimer)
                reportTimer = setTimeout(() => {
                    const tasks = taskExecutor.ListTasks().map((task) => FormatTaskForOutput(task))
                    ReportInstanceTasksToDaemon({ daemonSocketPath, instanceId, tasks })
                }, 120)
            }
            taskExecutor.AddTaskStatusListener(_reportTasks)
            _reportTasks()
        }

        // Remove o arquivo de socket ao encerrar (o processo é morto por SIGTERM
        // quando o daemon fecha a instância).
        const _cleanupSocket = () => { try { require("fs").unlinkSync(instanceTaskSocketPath) } catch(_){} }
        process.on("exit", _cleanupSocket)
        process.on("SIGTERM", () => { _cleanupSocket(); process.exit(0) })
        process.on("SIGINT",  () => { _cleanupSocket(); process.exit(0) })
    }

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

    const _Execute = async (environmentPath, executionParams) => {
        const taskIdList = taskExecutor.CreateTasks(executionParams)
        await WriteObjectToFile(join(environmentPath, "execution-params.json"), executionParams)
        const executionId = executionState.RegisterExecution(environmentPath, taskIdList)
        return executionId
    }
    
    try{
        // Estas variáveis são do ECOSSISTEMA EM EXECUÇÃO (ecosystem-defaults),
        // não dos startup-params do pacote: buscadas via handler. O ecosystemDefaults
        // é também a BASE injetada no merge por-nó do BuildMetadataHierarchy — os
        // startup-params próprios de cada pacote (do disco) sobrepõem por cima.
        // Se o arquivo não existir, o Get lança Error explícito (ecossistema não
        // instalado) e o erro propaga para o catch abaixo.
        const ecosystemDefaults = GetEcosystemDefaults(absolutInstallDataDirPath, ecosystemDefaultsFileRelativePath)
        const {
            REPOS_CONF_EXT_MODULE_DIR,
            REPOS_CONF_EXT_LAYER_DIR,
            REPOS_CONF_EXT_GROUP_DIR,
            REPOS_CONF_EXTLIST_PKG_TYPE,
            PKG_CONF_DIRNAME_METADATA,
            EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
            ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA
        } = ecosystemDefaults

        const _GetMetadataHierarchy = async (environmentPath) =>
            await ReadJsonFile(join(environmentPath, ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA))
        const _WriteMetadataGraphFile = async (environmentPath, tree) =>
            await WriteObjectToFile(join(environmentPath, ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA), tree)

        await PrepareRepositoriesFileJson({
            installDataDirPath:absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA,
            loggerEmitter
        })
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
            startupParams: { ...ecosystemDefaults },
            packageList,
            REPOS_CONF_EXT_GROUP_DIR,
            PKG_CONF_DIRNAME_METADATA
        })

        const environmentName = _GetEnvironmentName(metadataHierarchy, packagePath)
        const localPath =  _GetEnvironmentsPath()
        const environmentPath = await CreateEnvironment({
            environmentName, 
            localPath,
            loggerEmitter
        })

        await PrepareDataDir({ environmentPath, EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES, loggerEmitter})
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
