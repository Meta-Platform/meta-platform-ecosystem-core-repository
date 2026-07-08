const { join } = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { EventEmitter } = require('events')

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
        repositoryConfigHandlerLib,
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
        socket,
        onReady
    } = params

    const ReadAllPackageMetadata      = dependencyGraphBuilderLib.require("Utils/ReadAllPackageMetadata")
    const BuildMetadataHierarchy      = dependencyGraphBuilderLib.require("BuildMetadataHierarchy")
    const PrepareRepositoriesFileJson = repositoryConfigHandlerLib.require("PrepareRepositoriesFileJson")
    const CreateEnvironment           = environmentHandlerLib.require("CreateEnvironment")
    const PrepareDataDir              = environmentHandlerLib.require("PrepareDataDir")
    const ResolvePackageName          = resolvePackageNameLib.require("ResolvePackageName")
    const GetMetadataRootNode         = metadataHierarchyHandlerLib.require("GetMetadataRootNode")
    const WriteObjectToFile           = jsonFileUtilitiesLib.require("WriteObjectToFile")
    const ReadJsonFile                = jsonFileUtilitiesLib.require("ReadJsonFile")

    // Um pacote é DESKTOP (Electron) se o boot.json declara a seção "windows".
    const _IsDesktopPackage = async (packagePath) => {
        try {
            const boot = await ReadJsonFile(join(packagePath, PKG_CONF_DIRNAME_METADATA, "boot.json"))
            return Array.isArray(boot && boot.windows) && boot.windows.length > 0
        } catch(e) {
            return false
        }
    }

    // Registro dos processos DESKTOP lançados pelo daemon (packagePath → child),
    // para poder encerrá-los depois (eles não são tasks do executor in-process).
    const desktopProcesses = new Map()

    // Progresso de LANÇAMENTO de aplicações (para a área de trabalho refletir no
    // ícone: abrindo → build → aberto). O app lançado reporta seus eventos por
    // HTTP no socket deste daemon (ver ReportLaunchProgress); aqui mantemos o
    // último estado por launchId (= packagePath) e um emissor próprio — separado
    // do stream de tasks — que o controller expõe como WS (LaunchProgressStream).
    const launchProgressEmitter = new EventEmitter()
    const launchProgressState   = new Map()

    const _EmitLaunchProgress = ({ launchId, phase, percentage }) => {
        if(!launchId || !phase) return
        const state = { launchId, phase, ...(percentage !== undefined ? { percentage } : {}) }
        if(phase === "closed") launchProgressState.delete(launchId)
        else                   launchProgressState.set(launchId, state)
        launchProgressEmitter.emit("LAUNCH_PROGRESS", state)
    }

    // Ingest chamado pelo app lançado (electron-main) via POST. `phase` ∈
    // { window-ready | building | ready }; `percentage` só em building/ready.
    const ReportLaunchProgress = ({ launchId, phase, percentage } = {}) => {
        _EmitLaunchProgress({ launchId, phase, percentage })
        return {}
    }

    const GetLaunchProgressSnapshot = () => Array.from(launchProgressState.values())
    const GetLaunchProgressEmitter  = () => launchProgressEmitter

    // Executa um pacote DESKTOP em PROCESSO SEPARADO (via `run package`).
    // Necessário porque o desktop-window-instance loader faz process.exit(0) ao
    // fechar a janela Electron — se rodasse in-process, derrubaria o daemon.
    // `detached` cria um novo grupo de processos (pgid = pid) para encerrar a
    // árvore inteira (run + electron) depois.
    //
    // Injeta META_LAUNCH_PROGRESS_SOCKET/META_LAUNCH_ID no env: eles fluem pelo
    // `run` → taskLoader → OpenElectronWindow (que faz ...process.env) até o
    // electron-main, que POSTa o progresso de volta neste socket.
    const _RunDesktopInSeparateProcess = (packagePath) => {
        const executablesDirPath = join(ECO_DIRPATH_INSTALL_DATA, "executables")
        const env = {
            ...process.env,
            PATH: `${executablesDirPath}:${process.env.PATH}`,
            ...(socket ? { META_LAUNCH_PROGRESS_SOCKET: socket, META_LAUNCH_ID: packagePath } : {})
        }
        const child = spawn(join(executablesDirPath, "run"), ["package", packagePath], {
            cwd: ECO_DIRPATH_INSTALL_DATA,
            env,
            detached: true,
            stdio: "ignore"
        })
        desktopProcesses.set(packagePath, child)
        // Feedback imediato no ícone enquanto o Electron sobe (antes do window-ready).
        _EmitLaunchProgress({ launchId: packagePath, phase: "launching" })
        child.on("exit", () => {
            if(desktopProcesses.get(packagePath) === child)
                desktopProcesses.delete(packagePath)
            _EmitLaunchProgress({ launchId: packagePath, phase: "closed" })
        })
        child.unref()
    }

    // Encerra um pacote DESKTOP lançado pelo daemon (mata o grupo de processos).
    const _StopDesktopProcess = (packagePath) => {
        const child = desktopProcesses.get(packagePath)
        if(!child) return false
        try { process.kill(-child.pid, "SIGTERM") } catch(e) { try { child.kill("SIGTERM") } catch(_){} }
        desktopProcesses.delete(packagePath)
        return true
    }

    const _Start = async () => {
        await PrepareRepositoriesFileJson({
            installDataDirPath: ECO_DIRPATH_INSTALL_DATA,
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
            // DESKTOP → processo separado (isola o Electron do daemon).
            if(await _IsDesktopPackage(packagePath)){
                _RunDesktopInSeparateProcess(packagePath)
                return {}
            }

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

    // Encerra a execução de um pacote pelo seu caminho.
    // 1 parâmetro (packagePath) chega como valor direto (contrato do server-manager).
    // DESKTOP → mata o processo separado; demais → delega ao runtime in-process.
    const StopPackage = async (packagePath) => {
        if(_StopDesktopProcess(packagePath))
            return { stopped: true }
        return environmentRuntimeService.StopPackage(packagePath)
    }

    _Start()

    return {
        RunPackage,
        StopPackage,
        ListSupervisedPackages,
        ReportLaunchProgress,
        GetLaunchProgressSnapshot,
        GetLaunchProgressEmitter,
        GetTaskExecutorEventEmitter: environmentRuntimeService.GetTaskExecutorEventEmitter
    }

}

module.exports = EcosystemManager