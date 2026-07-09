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
        instanceStoreLib,
        repositoryManagerService,
        environmentRuntimeService,
        PKG_CONF_DIRNAME_METADATA,
        ECO_DIRPATH_INSTALL_DATA,
        REPOS_CONF_FILENAME_REPOS_DATA,
        REPOS_CONF_EXT_GROUP_DIR,
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
        instanceStoreFilePath,
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
    const InitializeInstanceStore     = instanceStoreLib.require("InitializeInstanceStore")

    // Registro persistente do que ESTE daemon colocou no ar. O daemon centraliza
    // a execução, então é ele quem deve informar aos painéis as instâncias que
    // rodou — inclusive as desktop, que vivem em processo separado e antes só
    // existiam num Map em memória, perdido a cada restart.
    const instanceStore = InitializeInstanceStore(instanceStoreFilePath)

    const _Log = (action, message) =>
        console.log(`${colors.bgCyan.black("[EcosystemManagerService]")} ${colors.inverse(`[${action}]`)} ${message}`)

    // O registro é observabilidade, não caminho crítico: se o SQLite falhar, o
    // lançamento/encerramento continua. Só logamos.
    const _SafeStore = async (operation) => {
        try {
            return await operation()
        } catch(e) {
            _Log("InstanceStore", `${colors.bgRed("ERROR")} ${e && e.message ? e.message : e}`)
        }
    }

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
    const _RunDesktopInSeparateProcess = async (packagePath, launchedBy) => {
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
        await _SafeStore(() => instanceStore.RegisterLaunch({
            packagePath,
            kind: instanceStore.KIND.DESKTOP,
            pid: child.pid,
            launchedBy
        }))
        // Feedback imediato no ícone enquanto o Electron sobe (antes do window-ready).
        _EmitLaunchProgress({ launchId: packagePath, phase: "launching" })
        child.on("exit", () => {
            if(desktopProcesses.get(packagePath) === child)
                desktopProcesses.delete(packagePath)
            _SafeStore(() => instanceStore.MarkStopped({ packagePath }))
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

    // Readota o que sobreviveu ao restart (desktop/cli com pid vivo) e descarta o
    // que morreu junto com o daemon (apps in-process) ou por conta própria.
    const _ReconcileInstances = async () => {
        const result = await _SafeStore(() => instanceStore.ConnectAndSync().then(() => instanceStore.Reconcile()))
        if(!result) return
        const { adopted, cleaned } = result
        if(adopted.length > 0) _Log("InstanceStore", `${adopted.length} instância(s) readotada(s) após restart`)
        if(cleaned.length > 0) _Log("InstanceStore", `${cleaned.length} instância(s) obsoleta(s) limpa(s)`)
    }

    const _Start = async () => {
        await PrepareRepositoriesFileJson({
            installDataDirPath: ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA
        })
        await _ReconcileInstances()
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

    const RunPackage = async ({ packagePath, startupParams, launchedBy }) => {
        try{
            // DESKTOP → processo separado (isola o Electron do daemon).
            if(await _IsDesktopPackage(packagePath)){
                await _RunDesktopInSeparateProcess(packagePath, launchedBy)
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

            const executionId = await environmentRuntimeService.ExecuteEnvironment(environmentPath)

            // App in-process: registra o lançamento e amarra os ids de runtime. O
            // taskId só existe depois de executar o ambiente, e a application-task
            // é identificada pelo rootPath.
            await _SafeStore(async () => {
                await instanceStore.RegisterLaunch({
                    packagePath,
                    kind: instanceStore.KIND.APP,
                    executionId,
                    launchedBy
                })
                const applicationTask = FindApplicationTaskByRootPath(environmentRuntimeService.ListApplicationTask(), packagePath)
                if(applicationTask)
                    await instanceStore.AttachRuntimeIds({ packagePath, taskId: applicationTask.taskId })
            })

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

            // Apps DESKTOP não são tasks do executor in-process: eles rodam em
            // processo separado. Sem isto, um desktop lançado pelo daemon nunca
            // apareceria como "em serviço" nos painéis.
            const desktopInstanceList = (await ListInstances())
                .filter((instance) => instance.kind === instanceStore.KIND.DESKTOP)
            const desktopByPath = desktopInstanceList
                .reduce((acc, instance) => ({ ...acc, [instance.packagePath]: instance }), {})

            const packageStatusPromises = listAllRepositoriesPackage
                .map(async (packageRepositoryParams) => {
                    const packagePath = await repositoryManagerService.GetPackagePath(packageRepositoryParams)
                    const applicationTask = FindApplicationTaskByRootPath(applicationTasks, packagePath)
                    const desktopInstance = desktopByPath[packagePath]
                    const metadata = await ReadAllPackageMetadata({
                        path: packagePath,
                        PKG_CONF_DIRNAME_METADATA
                    })
                    const packageInService = !!applicationTask || !!desktopInstance
                    return {
                        repositoryParams: packageRepositoryParams,
                        hasIcon: await repositoryManagerService.CheckPackageHasIcon(packageRepositoryParams),
                        ...metadata ? { metadata } : {},
                        packageInService,
                        ...applicationTask
                            ? { applicationInServiceState: ExtractStateByTask(applicationTask) }
                            : desktopInstance
                                ? { applicationInServiceState: { status: "ACTIVE", pid: desktopInstance.pid, kind: "desktop", staticParameters: {} } }
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
        if(_StopDesktopProcess(packagePath)){
            await _SafeStore(() => instanceStore.MarkStopped({ packagePath }))
            return { stopped: true }
        }
        const result = await environmentRuntimeService.StopPackage(packagePath)
        await _SafeStore(() => instanceStore.MarkStopped({ packagePath }))
        return result
    }

    // Instâncias que ESTE daemon colocou no ar, com o estado vivo de cada uma.
    //
    // A verdade de cada kind vem de uma fonte diferente:
    //   app     → status da application-task no task-executor in-process
    //   desktop → o pid ainda está vivo?
    // Uma linha marcada como RUNNING no banco cujo processo/task sumiu é
    // corrigida aqui (o daemon nem sempre recebe o evento de saída).
    const ListInstances = async () => {
        const runningList = await _SafeStore(() => instanceStore.ListRunning())
        if(!runningList) return []

        const applicationTasks = environmentRuntimeService.ListApplicationTask()

        const instanceList = await Promise.all(runningList.map(async (instance) => {
            if(instance.kind === instanceStore.KIND.APP){
                const task = FindApplicationTaskByRootPath(applicationTasks, instance.packagePath)
                if(!task){
                    await _SafeStore(() => instanceStore.MarkStopped({ packagePath: instance.packagePath }))
                    return undefined
                }
                return { ...instance, status: task.status, taskId: task.taskId, objectLoaderType: task.objectLoaderType }
            }

            if(!instanceStore.IsProcessAlive(instance.pid)){
                await _SafeStore(() => instanceStore.MarkStopped({ packagePath: instance.packagePath }))
                return undefined
            }
            return { ...instance, status: "ACTIVE" }
        }))

        return instanceList.filter(Boolean)
    }

    _Start()

    return {
        RunPackage,
        StopPackage,
        ListInstances,
        ListSupervisedPackages,
        ReportLaunchProgress,
        GetLaunchProgressSnapshot,
        GetLaunchProgressEmitter,
        GetTaskExecutorEventEmitter: environmentRuntimeService.GetTaskExecutorEventEmitter
    }

}

module.exports = EcosystemManager