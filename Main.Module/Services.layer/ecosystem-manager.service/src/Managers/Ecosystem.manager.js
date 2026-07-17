const { join, dirname } = require('path')
const http = require('http')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { EventEmitter } = require('events')

// Nome do servidor que cada instância desktop publica no seu socket de tarefas
// (ver package-runner.cli / StartInstanceTaskSocketServer).
const INSTANCE_TASK_SERVER_NAME = "InstanceTaskExecutor"

// Caminho base (fixo) do endpoint de tarefas que o processo da instância publica.
const INSTANCE_TASK_ENDPOINT = "/task-executor-machine"

// Chamada HTTP-sobre-Unix-socket enxuta (só http nativo). Falamos direto com os
// caminhos fixos que a instância publica — sem descoberta via mount-api, para o
// daemon não depender de nenhuma lib nova (o que quebraria a montagem do grafo).
const _HttpOverSocket = ({ socketPath, method, path, body }) => new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const req = http.request({
        socketPath,
        path,
        method,
        headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}
    }, (res) => {
        let data = ""
        res.on("data", (chunk) => { data += chunk })
        res.on("end", () => {
            if(res.statusCode >= 200 && res.statusCode < 300){
                try { resolve(data ? JSON.parse(data) : undefined) } catch(e){ resolve(data) }
            } else reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        })
    })
    req.on("error", reject)
    if(payload) req.write(payload)
    req.end()
})

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
        ecosystemDefaultsHandlerLib,
        repositoryManagerService,
        environmentRuntimeService,
        PKG_CONF_DIRNAME_METADATA,
        ECO_DIRPATH_INSTALL_DATA,
        REPOS_CONF_FILENAME_REPOS_DATA,
        REPOS_CONF_EXT_GROUP_DIR,
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
        configurationsDirName,
        ecosystemDefaultsFileName,
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
    const GetEcosystemDefaults        = ecosystemDefaultsHandlerLib.require("Get")

    // Carrega UMA vez, na construção do manager, o ecosystem-defaults.json
    // materializado no EcosystemData. Esse objeto é a BASE de startupParams
    // injetada na hierarquia de metadados, para os {{VAR}} dos pacotes
    // resolverem sem depender de literal. O caminho relativo segue a mesma
    // convenção do command-line-runtime-manager.service:
    // <configurationsDirName>/<ecosystemDefaultsFileName>.
    // O Get lança erro explícito se o arquivo não existir — propositalmente
    // deixamos propagar: sem defaults materializados o ecossistema não está
    // instalado e o daemon deve falhar alto e claro.
    const ecosystemDefaults = GetEcosystemDefaults(
        ECO_DIRPATH_INSTALL_DATA,
        join(configurationsDirName, ecosystemDefaultsFileName)
    )

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

    // Registro dos processos DESKTOP lançados pelo daemon (instanceId → { child,
    // packagePath }), para poder encerrá-los depois (eles não são tasks do
    // executor in-process). A chave é o instanceId — e não o packagePath —
    // porque o mesmo pacote pode estar aberto em várias instâncias, e cada uma
    // tem o seu próprio processo a encerrar.
    const desktopProcesses = new Map()

    // Cada lançamento tem uma identidade própria, gerada aqui. É ela que viaja
    // como META_LAUNCH_ID até o Electron e volta nos eventos de progresso, e é
    // por ela que uma instância é encerrada e contada.
    const _CreateInstanceId = () => crypto.randomUUID()

    // Caminho do Unix socket que a instância desktop abre para expor suas tarefas.
    // Fica ao lado do socket do próprio daemon (mesma pasta sockets/), numa
    // subpasta por-instância. O processo filho cria o diretório ao subir.
    const _CreateInstanceTaskSocketPath = (instanceId) =>
        join(dirname(socket || join(ECO_DIRPATH_INSTALL_DATA, "sockets", "x")), "instance-tasks", `${instanceId}.sock`)

    // PUSH das tarefas internas por instância: o processo de cada instância
    // (desktop) reporta sua lista de tarefas aqui (ReportInstanceTasks) a cada
    // mudança; guardamos o último estado por instanceId e emitimos, para o painel
    // acompanhar por WebSocket (InstanceTaskStream) — sem polling.
    const instanceTasksCache   = new Map()
    const instanceTasksEmitter = new EventEmitter()
    instanceTasksEmitter.setMaxListeners(0)

    // Mudanças na LISTA DE INSTÂNCIAS (lançou/encerrou qualquer instância). É a
    // fonte de reatividade do painel: o stream InstanceList do daemon assina isto
    // e reenvia a lista inteira. Emissor DEDICADO — não dependemos do task-executor.
    const instancesEmitter = new EventEmitter()
    instancesEmitter.setMaxListeners(0)
    const _EmitInstancesChange = () => { try { instancesEmitter.emit("INSTANCES_CHANGE") } catch(e){} }
    const GetInstancesEmitter  = () => instancesEmitter

    // Progresso de LANÇAMENTO de aplicações (para a área de trabalho refletir no
    // ícone: abrindo → build → aberto). O app lançado reporta seus eventos por
    // HTTP no socket deste daemon (ver ReportLaunchProgress); aqui mantemos o
    // último estado por launchId (= instanceId) e um emissor próprio — separado
    // do stream de tasks — que o controller expõe como WS (LaunchProgressStream).
    const launchProgressEmitter = new EventEmitter()
    const launchProgressState   = new Map()

    // O evento carrega o packagePath junto do launchId: o painel conhece o
    // pacote que mandou abrir, não o instanceId (que só nasce aqui), e precisa
    // dos dois para saber a QUAL ícone o progresso pertence e QUAL instância
    // daquele ícone acabou de abrir ou fechar.
    const _ResolveLaunchPackagePath = (launchId) => {
        const registered = desktopProcesses.get(launchId)
        if(registered) return registered.packagePath
        const state = launchProgressState.get(launchId)
        return state && state.packagePath
    }

    const _EmitLaunchProgress = ({ launchId, phase, percentage, packagePath }) => {
        if(!launchId || !phase) return
        const resolvedPath = packagePath || _ResolveLaunchPackagePath(launchId)
        const state = {
            launchId,
            phase,
            ...(resolvedPath !== undefined ? { packagePath: resolvedPath } : {}),
            ...(percentage !== undefined ? { percentage } : {})
        }
        if(phase === "closed") launchProgressState.delete(launchId)
        else                   launchProgressState.set(launchId, state)
        launchProgressEmitter.emit("LAUNCH_PROGRESS", state)
    }

    // Ingest chamado pelo app lançado (electron-main) via POST. `phase` ∈
    // { window-ready | building | ready }; `percentage` só em building/ready.
    // O app só conhece o seu launchId; o packagePath é resolvido aqui.
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
        const instanceId = _CreateInstanceId()
        const executablesDirPath = join(ECO_DIRPATH_INSTALL_DATA, "executables")
        // O processo separado abre um socket expondo seu task-executor; é por ele
        // que consultamos as tarefas internas desta instância (ver ListInstanceTasks).
        const taskSocketPath = _CreateInstanceTaskSocketPath(instanceId)
        const env = {
            ...process.env,
            PATH: `${executablesDirPath}:${process.env.PATH}`,
            ...(socket ? { META_LAUNCH_PROGRESS_SOCKET: socket, META_LAUNCH_ID: instanceId } : {}),
            META_INSTANCE_TASK_SOCKET: taskSocketPath,
            META_INSTANCE_TASK_SERVER_NAME: INSTANCE_TASK_SERVER_NAME
        }
        const child = spawn(join(executablesDirPath, "run"), ["package", packagePath], {
            cwd: ECO_DIRPATH_INSTALL_DATA,
            env,
            detached: true,
            stdio: "ignore"
        })
        desktopProcesses.set(instanceId, { child, packagePath })
        await _SafeStore(() => instanceStore.RegisterLaunch({
            instanceId,
            packagePath,
            kind: instanceStore.KIND.DESKTOP,
            pid: child.pid,
            taskSocketPath,
            launchedBy
        }))
        // Feedback imediato no ícone enquanto o Electron sobe (antes do window-ready).
        _EmitLaunchProgress({ launchId: instanceId, packagePath, phase: "launching" })
        _EmitInstancesChange()
        child.on("exit", () => {
            const registered = desktopProcesses.get(instanceId)
            if(registered && registered.child === child)
                desktopProcesses.delete(instanceId)
            instanceTasksCache.delete(instanceId)
            _SafeStore(() => instanceStore.MarkStopped({ instanceId }))
            // O packagePath é passado explicitamente: o processo já saiu do mapa,
            // então não haveria de onde resolvê-lo.
            _EmitLaunchProgress({ launchId: instanceId, packagePath, phase: "closed" })
            _EmitInstancesChange()
        })
        child.unref()
        return instanceId
    }

    // Mata o grupo de processos de um pid (o spawn é `detached`, então pgid = pid).
    // Usado quando o daemon reiniciou e perdeu o handle do child, mas o registro
    // guardou o pid da instância readotada.
    const _KillProcessGroup = (pid) => {
        if(!pid || !instanceStore.IsProcessAlive(pid)) return false
        try { process.kill(-pid, "SIGTERM"); return true }
        catch(e) {
            try { process.kill(pid, "SIGTERM"); return true } catch(_){ return false }
        }
    }

    // Encerra UMA instância DESKTOP lançada pelo daemon (mata o grupo de processos).
    const _StopDesktopProcess = (instanceId) => {
        const registered = desktopProcesses.get(instanceId)
        if(!registered) return false
        const { child } = registered
        try { process.kill(-child.pid, "SIGTERM") } catch(e) { try { child.kill("SIGTERM") } catch(_){} }
        desktopProcesses.delete(instanceId)
        return true
    }

    // Encerra TODAS as instâncias DESKTOP de um pacote. É o comportamento do
    // encerramento por packagePath, que não distingue instâncias.
    const _StopDesktopProcessesByPackage = (packagePath) => {
        const instanceIdList = Array.from(desktopProcesses.entries())
            .filter(([, registered]) => registered.packagePath === packagePath)
            .map(([instanceId]) => instanceId)
        instanceIdList.forEach(_StopDesktopProcess)
        return instanceIdList.length > 0
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
                const instanceId = await _RunDesktopInSeparateProcess(packagePath, launchedBy)
                return { instanceId }
            }

            const packageList = await repositoryManagerService.ListPackages()

            // Composição do startupParams injetado (BASE da hierarquia):
            //   ecosystemDefaults  → base do ecossistema (config materializada)
            //   startupParams      → o que o chamador passou sobrepõe o ecossistema
            // O startup-params.json de cada nó ainda sobrepõe ambos, via merge
            // por-nó feito no ReplaceStartupParams do dependency-graph-builder.
            const injected = { ...ecosystemDefaults, ...(startupParams || {}) }

            const metadataHierarchy = await BuildMetadataHierarchy({
                path: packagePath,
                startupParams: injected,
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
            const instanceId = _CreateInstanceId()
            await _SafeStore(async () => {
                await instanceStore.RegisterLaunch({
                    instanceId,
                    packagePath,
                    kind: instanceStore.KIND.APP,
                    executionId,
                    launchedBy
                })
                const applicationTask = FindApplicationTaskByRootPath(environmentRuntimeService.ListApplicationTask(), packagePath)
                if(applicationTask)
                    await instanceStore.AttachRuntimeIds({ instanceId, taskId: applicationTask.taskId })
            })
            _EmitInstancesChange()

            return { instanceId }
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
            // apareceria como "em serviço" nos painéis. Um mesmo pacote pode ter
            // várias instâncias abertas, então agrupamos por caminho.
            const desktopInstanceList = (await ListInstances())
                .filter((instance) => instance.kind === instanceStore.KIND.DESKTOP)
            const desktopByPath = desktopInstanceList.reduce((acc, instance) => ({
                ...acc,
                [instance.packagePath]: [ ...(acc[instance.packagePath] || []), instance ]
            }), {})

            const packageStatusPromises = listAllRepositoriesPackage
                .map(async (packageRepositoryParams) => {
                    const packagePath = await repositoryManagerService.GetPackagePath(packageRepositoryParams)
                    const applicationTask = FindApplicationTaskByRootPath(applicationTasks, packagePath)
                    const desktopInstances = desktopByPath[packagePath] || []
                    const [ desktopInstance ] = desktopInstances
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
                        ...desktopInstances.length > 0 ? { instanceCount: desktopInstances.length } : {},
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

    // Encerra a execução de um pacote pelo seu caminho — TODAS as instâncias dele.
    // 1 parâmetro (packagePath) chega como valor direto (contrato do server-manager).
    // DESKTOP → mata os processos separados; demais → delega ao runtime in-process.
    const StopPackage = async (packagePath) => {
        if(_StopDesktopProcessesByPackage(packagePath)){
            await _SafeStore(() => instanceStore.MarkStoppedByPackage({ packagePath }))
            _EmitInstancesChange()
            return { stopped: true }
        }
        const result = await environmentRuntimeService.StopPackage(packagePath)
        await _SafeStore(() => instanceStore.MarkStoppedByPackage({ packagePath }))
        _EmitInstancesChange()
        return result
    }

    // Encerra UMA instância pelo seu instanceId — é o que permite fechar a janela
    // certa quando o mesmo pacote está aberto várias vezes.
    // 1 parâmetro (instanceId) chega como valor direto (contrato do server-manager).
    const StopInstance = async (instanceId) => {
        if(_StopDesktopProcess(instanceId)){
            await _SafeStore(() => instanceStore.MarkStopped({ instanceId }))
            _EmitInstancesChange()
            return { stopped: true, instanceId }
        }

        const instance = await _SafeStore(() => instanceStore.Get({ instanceId }))
        if(!instance) throw new Error(`Instância não encontrada: ${instanceId}`)

        // Desktop readotado depois de um restart: o daemon perdeu o handle do
        // child, mas o pid registrado ainda identifica o grupo de processos.
        if(instance.kind === instanceStore.KIND.DESKTOP && _KillProcessGroup(instance.pid)){
            await _SafeStore(() => instanceStore.MarkStopped({ instanceId }))
            _EmitInstancesChange()
            return { stopped: true, instanceId }
        }

        // App in-process: o encerramento cai no runtime, pelo pacote.
        const result = await environmentRuntimeService.StopPackage(instance.packagePath)
        await _SafeStore(() => instanceStore.MarkStopped({ instanceId }))
        _EmitInstancesChange()
        return { ...result, instanceId }
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
                    await _SafeStore(() => instanceStore.MarkStopped({ instanceId: instance.instanceId }))
                    return undefined
                }
                return { ...instance, status: task.status, taskId: task.taskId, objectLoaderType: task.objectLoaderType }
            }

            if(!instanceStore.IsProcessAlive(instance.pid)){
                await _SafeStore(() => instanceStore.MarkStopped({ instanceId: instance.instanceId }))
                return undefined
            }
            return { ...instance, status: "ACTIVE" }
        }))

        return instanceList.filter(Boolean)
    }

    // Tarefas INTERNAS de uma instância. Para desktop, consultamos o socket do
    // processo separado dela; se o socket estiver morto (instância encerrando),
    // degrada para lista vazia. Para `app`, as tarefas estão no executor
    // in-process do daemon e o painel já as recorta da lista global — aqui
    // devolvemos vazio para não duplicar essa fonte.
    // 1 parâmetro (instanceId) chega como valor direto (contrato do server-manager).
    const ListInstanceTasks = async (instanceId) => {
        const instance = await _SafeStore(() => instanceStore.Get({ instanceId }))
        if(!instance || !instance.taskSocketPath) return []
        try {
            const tasks = await _HttpOverSocket({
                socketPath: instance.taskSocketPath,
                method: "GET",
                path: `${INSTANCE_TASK_ENDPOINT}/list-task`
            })
            return tasks || []
        } catch(e) {
            return []
        }
    }

    // Ingest de tarefas vindo do processo da instância (POST). Guarda o último
    // estado e emite, para os streams abertos empurrarem ao painel.
    // 2 parâmetros → chegam como objeto.
    const ReportInstanceTasks = ({ instanceId, tasks } = {}) => {
        if(!instanceId) return {}
        instanceTasksCache.set(instanceId, tasks || [])
        instanceTasksEmitter.emit("INSTANCE_TASKS_CHANGE", { instanceId, tasks: tasks || [] })
        return {}
    }

    // Stream (WS) das tarefas internas de UMA instância. Manda o estado inicial
    // (cache; se vazio, um pull único pelo socket da instância) e, em seguida,
    // cada atualização empurrada pelo processo. Sem polling.
    // 1 parâmetro (instanceId) chega como valor direto (contrato do server-manager).
    const InstanceTaskStream = (ws, instanceId) => {
        const _send = (tasks) => { try { ws.send(JSON.stringify(tasks || [])) } catch(e){} }

        if(instanceTasksCache.has(instanceId)) _send(instanceTasksCache.get(instanceId))
        else ListInstanceTasks(instanceId).then(_send).catch(() => {})

        const onChange = (payload) => { if(payload && payload.instanceId === instanceId) _send(payload.tasks) }
        instanceTasksEmitter.on("INSTANCE_TASKS_CHANGE", onChange)
        ws.on && ws.on("close", () => {
            try { instanceTasksEmitter.removeListener("INSTANCE_TASKS_CHANGE", onChange) } catch(e){}
        })
    }

    // Encerra tarefas internas de uma instância desktop, delegando ao task-executor
    // do processo dela. 2 parâmetros → chegam como objeto.
    const StopInstanceTasks = async ({ instanceId, taskIds } = {}) => {
        const instance = await _SafeStore(() => instanceStore.Get({ instanceId }))
        if(!instance || !instance.taskSocketPath) return { stopped: false }
        try {
            const ids = Array.isArray(taskIds) ? taskIds : [taskIds]
            const result = await _HttpOverSocket({
                socketPath: instance.taskSocketPath,
                method: "POST",
                path: `${INSTANCE_TASK_ENDPOINT}/stop-tasks`,
                body: { taskIds: ids }
            })
            return result || { stopped: true }
        } catch(e) {
            return { stopped: false }
        }
    }

    _Start()

    return {
        RunPackage,
        StopPackage,
        StopInstance,
        ListInstances,
        ListInstanceTasks,
        ReportInstanceTasks,
        InstanceTaskStream,
        StopInstanceTasks,
        ListSupervisedPackages,
        ReportLaunchProgress,
        GetLaunchProgressSnapshot,
        GetLaunchProgressEmitter,
        GetInstancesEmitter,
        GetTaskExecutorEventEmitter: environmentRuntimeService.GetTaskExecutorEventEmitter
    }

}

module.exports = EcosystemManager