const { join, dirname } = require('path')
const fs = require('fs')
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
        processMetricsLib,
        ecosystemDefaultsHandlerLib,
        resourceParamsHandlerLib,
        repositoryManagerService,
        environmentRuntimeService,
        taskExecutorMachineService,
        PKG_CONF_DIRNAME_METADATA,
        ECO_DIRPATH_INSTALL_DATA,
        REPOS_CONF_FILENAME_REPOS_DATA,
        REPOS_CONF_EXT_GROUP_DIR,
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
        configurationsDirName,
        ecosystemDefaultsFileName,
        instanceStoreFilePath,
        metricsSampleIntervalMs,
        metricsHistorySize,
        instanceLogMaxBytes,
        instanceLogRetentionDays,
        socket,
        onReady
    } = params

    // Parâmetros de observabilidade têm default no código (e não só no
    // startup-params) para uma instalação anterior a eles continuar subindo: um
    // {{VAR}} não declarado chega como null, e null não pode virar intervalo de
    // amostragem.
    const METRICS_SAMPLE_INTERVAL_MS  = Number(metricsSampleIntervalMs)  || 2000
    const METRICS_HISTORY_SIZE        = Number(metricsHistorySize)       || 300
    const INSTANCE_LOG_MAX_BYTES      = Number(instanceLogMaxBytes)      || (8 * 1024 * 1024)
    const INSTANCE_LOG_RETENTION_DAYS = Number(instanceLogRetentionDays) || 7

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

    // Observabilidade é acessório: se a lib de métricas não estiver montada
    // (instalação antiga, boot.json sem o bound-param), o daemon continua
    // executando pacotes normalmente — só não reporta desempenho.
    const CreateProcessSampler = processMetricsLib && processMetricsLib.require("CreateProcessSampler")
    const CreateMetricsHistory = processMetricsLib && processMetricsLib.require("CreateMetricsHistory")

    // Recursos declarados (socket-params/storage-params) seguem a mesma postura:
    // uma instalação anterior a esta lib não tem o bound-param no boot.json, e o
    // daemon precisa continuar executando pacotes — só que sem resolver recurso,
    // o que mantém válido o caminho literal do startup-params.json de antes.
    const ApplyResourceParamsToHierarchy = resourceParamsHandlerLib && resourceParamsHandlerLib.require("ApplyResourceParamsToHierarchy")
    const EnsureResources                = resourceParamsHandlerLib && resourceParamsHandlerLib.require("EnsureResources")

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

    // Caminho do Unix socket de CONTROLE DE JANELA da instância desktop (quem o
    // abre é o electron-main). É por ele que trazemos uma janela já aberta para
    // frente em vez de lançar outra instância. O caminho é DERIVADO do
    // instanceId — assim continua resolvível para instâncias readotadas após um
    // restart do daemon, sem precisar guardá-lo no registro.
    const _CreateInstanceWindowSocketPath = (instanceId) =>
        join(dirname(socket || join(ECO_DIRPATH_INSTALL_DATA, "sockets", "x")), "instance-windows", `${instanceId}.sock`)

    // Log por instância. Fica em <install-data>/instance-logs/<instanceId>.log,
    // seguindo o mesmo esquema por-instância dos sockets. É o rastro que responde
    // "por que terminou": para desktop recebe o stdout/stderr do processo (antes
    // descartado com stdio:"ignore") + código de saída; para app in-process recebe
    // as transições de estado da execução, incluindo o motivo em caso de ERROR.
    const _CreateInstanceLogPath = (instanceId) =>
        join(ECO_DIRPATH_INSTALL_DATA, "instance-logs", `${instanceId}.log`)

    const _EnsureInstanceLogPath = (instanceId) => {
        const logPath = _CreateInstanceLogPath(instanceId)
        fs.mkdirSync(dirname(logPath), { recursive: true })
        return logPath
    }

    const _NowLocalISO = () => {
        const now = new Date()
        const offset = now.getTimezoneOffset() * 60000
        return (new Date(now - offset)).toISOString()
    }

    // Anexa uma linha ao log da instância. Observabilidade, não caminho crítico:
    // qualquer erro de escrita é engolido para não derrubar um launch/stop.
    const _AppendInstanceLog = (instanceId, message) => {
        try {
            fs.appendFileSync(_EnsureInstanceLogPath(instanceId), `[${_NowLocalISO()}] ${message}\n`)
        } catch(e) {}
    }

    // ---- Leitura do log da instância -------------------------------------
    //
    // O log já era gravado, mas não havia como lê-lo sem abrir um terminal e
    // conhecer o instanceId — ou seja, o rastro que responde "por que morreu"
    // existia e era inalcançável pela interface. Estas funções o servem.

    // Teto do que se lê de uma vez. Um log de uma sessão longa tem dezenas de MB;
    // mandar isso pelo socket travaria a interface e não seria lido por ninguém.
    const LOG_READ_MAX_BYTES = 512 * 1024

    // Lê um pedaço do fim do arquivo (ou a partir de um offset conhecido) e o
    // devolve em linhas. `offset` volta para o chamador continuar de onde parou —
    // é o que torna o acompanhamento incremental, sem reenviar o log inteiro.
    const _ReadLogSlice = (logPath, { fromOffset, maxBytes = LOG_READ_MAX_BYTES } = {}) => {
        const { size } = fs.statSync(logPath)

        // Offset maior que o arquivo = ele foi truncado (rotação) desde a última
        // leitura. Recomeçar do início é o único resultado correto.
        const isRotated = fromOffset !== undefined && fromOffset > size
        const start = (fromOffset !== undefined && !isRotated)
            ? fromOffset
            : Math.max(0, size - maxBytes)

        if(start >= size)
            return { lines: [], offset: size, size, truncated: false, rotated: isRotated }

        const length = Math.min(size - start, maxBytes)
        const buffer = Buffer.alloc(length)

        const fd = fs.openSync(logPath, "r")
        try { fs.readSync(fd, buffer, 0, length, start) }
        finally { try { fs.closeSync(fd) } catch(e) {} }

        let text = buffer.toString("utf8")

        // Começamos no meio do arquivo: a primeira linha quase sempre está
        // cortada ao meio. Descartá-la evita exibir lixo no topo.
        const startedMidFile = start > 0 && fromOffset === undefined
        if(startedMidFile){
            const firstBreak = text.indexOf("\n")
            if(firstBreak >= 0) text = text.slice(firstBreak + 1)
        }

        const lines = text.split("\n")
        // Última linha sem "\n" = escrita ainda em curso. Fica para a próxima
        // leitura, e o offset recua para não perdê-la.
        const pendingBytes = Buffer.byteLength(lines[lines.length - 1], "utf8")
        lines.pop()

        return {
            lines,
            offset: (start + length) - pendingBytes,
            size,
            truncated: startedMidFile,
            rotated: isRotated
        }
    }

    // Lê o log de uma instância. Sem `fromOffset`, devolve as últimas linhas;
    // com ele, só o que foi escrito depois. 2+ params → chegam como objeto.
    const ReadInstanceLog = async ({ instanceId, tailLines = 500, fromOffset } = {}) => {
        if(!instanceId) throw new Error("ReadInstanceLog: 'instanceId' é obrigatório.")

        const logPath = _CreateInstanceLogPath(instanceId)

        let slice
        try { slice = _ReadLogSlice(logPath, { fromOffset }) }
        catch(e) {
            // Instância sem log ainda (acabou de subir) não é erro: é log vazio.
            return { instanceId, lines: [], offset: 0, size: 0, exists: false }
        }

        const lines = (fromOffset === undefined && slice.lines.length > tailLines)
            ? slice.lines.slice(slice.lines.length - tailLines)
            : slice.lines

        return { instanceId, exists: true, path: logPath, ...slice, lines }
    }

    // Acompanhamento ao vivo do log de uma instância (WS).
    //
    // Usa `fs.watchFile` (stat periódico) e não `fs.watch` (inotify) de
    // propósito: o arquivo pode AINDA NÃO EXISTIR quando o painel abre a aba
    // (instância recém-lançada) — inotify falharia no arquivo ausente — e quem
    // escreve é outro processo, pelo fd herdado no spawn. O stat só roda
    // enquanto houver alguém assistindo.
    // 1 parâmetro (instanceId) chega como valor direto.
    const InstanceLogStream = (ws, instanceId) => {
        if(!instanceId) { try { ws.close() } catch(e){} ; return }

        const logPath = _CreateInstanceLogPath(instanceId)
        let offset = 0
        let closed = false

        const _send = (payload) => { try { ws.send(JSON.stringify(payload)) } catch(e){} }

        const _pump = async (type) => {
            if(closed) return
            const result = await ReadInstanceLog({ instanceId, fromOffset: offset })
            if(!result.exists) return
            offset = result.offset
            if(result.lines.length > 0 || type === "snapshot")
                _send({ type, instanceId, lines: result.lines, size: result.size, rotated: result.rotated })
        }

        // Estado inicial: as últimas linhas do que já existe.
        ReadInstanceLog({ instanceId })
            .then((result) => {
                if(closed) return
                offset = result.offset
                _send({ type: "snapshot", instanceId, lines: result.lines, size: result.size, exists: result.exists })
            })
            .catch(() => {})

        const onChange = (current, previous) => {
            if(current.mtimeMs === previous.mtimeMs && current.size === previous.size) return
            _pump("append").catch(() => {})
        }

        fs.watchFile(logPath, { interval: 400 }, onChange)

        ws.on && ws.on("close", () => {
            closed = true
            try { fs.unwatchFile(logPath, onChange) } catch(e){}
        })
    }

    // Inventário dos logs em disco, cruzado com o que o registro sabe de cada
    // instância. É o que permite abrir o log de algo que já morreu — justamente
    // o caso em que o log importa mais.
    const ListInstanceLogs = async () => {
        const logDir = dirname(_CreateInstanceLogPath("x"))

        let fileList
        try { fileList = fs.readdirSync(logDir) }
        catch(e) { return [] }

        const instanceList = (await _SafeStore(() => instanceStore.List())) || []
        const instanceById = new Map(instanceList.map((instance) => [instance.instanceId, instance]))

        return fileList
            .filter((fileName) => fileName.endsWith(".log"))
            .map((fileName) => {
                const instanceId = fileName.replace(/\.log$/, "")
                let stats
                try { stats = fs.statSync(join(logDir, fileName)) }
                catch(e) { return undefined }

                const instance = instanceById.get(instanceId)
                return {
                    instanceId,
                    sizeBytes:   stats.size,
                    modifiedAt:  stats.mtime,
                    packagePath: instance && instance.packagePath,
                    kind:        instance && instance.kind,
                    status:      instance && instance.status,
                    launchedBy:  instance && instance.launchedBy
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.modifiedAt - a.modifiedAt)
    }

    // Um desktop de sessão longa escreve no log pelo fd herdado, sem limite. Como
    // não controlamos esse fd, o corte é feito por truncamento do arquivo: com
    // O_APPEND o kernel recalcula o offset, então o processo continua escrevendo
    // normalmente a partir do zero.
    const _TruncateOversizedLog = (instanceId) => {
        const logPath = _CreateInstanceLogPath(instanceId)
        try {
            if(fs.statSync(logPath).size <= INSTANCE_LOG_MAX_BYTES) return
            fs.truncateSync(logPath, 0)
            _AppendInstanceLog(instanceId, `[daemon] log truncado ao passar de ${INSTANCE_LOG_MAX_BYTES} bytes`)
        } catch(e) {}
    }

    // Um arquivo de log por LANÇAMENTO (o instanceId é único por execução), então
    // a pasta cresce para sempre. No start, apaga o que é velho e não pertence a
    // nenhuma instância viva.
    const _PruneInstanceLogs = async () => {
        const logList = await ListInstanceLogs()
        const limitMs = Date.now() - (INSTANCE_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
        const logDir  = dirname(_CreateInstanceLogPath("x"))

        const removed = logList.filter((log) =>
            log.status !== instanceStore.STATUS.RUNNING && log.modifiedAt.getTime() < limitMs)

        removed.forEach((log) => {
            try { fs.unlinkSync(join(logDir, `${log.instanceId}.log`)) } catch(e) {}
        })

        if(removed.length > 0)
            _Log("InstanceLogs", `${removed.length} log(s) de instância expirado(s) removido(s)`)
    }

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

    // ---- Desempenho por instância ----------------------------------------
    //
    // O daemon sabia O QUE colocou no ar, mas não COMO cada coisa está indo. Sem
    // isto não há gráfico de desempenho possível no painel: ninguém mais tem os
    // pids, e um painel que amostrasse por conta própria só mediria enquanto
    // estivesse aberto.
    //
    // O sampler é criado UMA vez: uso de CPU é a derivada de um contador
    // acumulado, então recriá-lo a cada amostra devolveria zero para sempre.

    const metricsSampler = CreateProcessSampler ? CreateProcessSampler() : undefined
    const metricsHistory = CreateMetricsHistory ? CreateMetricsHistory({ capacity: METRICS_HISTORY_SIZE }) : undefined

    const metricsEmitter = new EventEmitter()
    metricsEmitter.setMaxListeners(0)

    // Último snapshot completo — é o que um cliente recém-conectado recebe antes
    // do primeiro tick, para a tela não abrir vazia.
    let lastMetricsSnapshot = { at: undefined, system: undefined, instances: [] }

    // pids já amostrados, para descartar a linha de base de quem morreu.
    const sampledPidByInstanceId = new Map()

    let sampleTickCount = 0
    let metricsTimer

    const _GroupTasksByStatus = (taskList) =>
        (taskList || []).reduce((acc, task) => ({ ...acc, [task.status]: (acc[task.status] || 0) + 1 }), {})

    // Subárvore de tarefas de uma instância `app`, recortada da lista global do
    // task-executor do daemon pela task raiz (mesma regra que o painel aplica).
    const _CollectTaskSubtree = (taskList, rootTaskId) => {
        const childrenOf = new Map()
        taskList.forEach((task) => {
            if(task.pTaskId === undefined || task.pTaskId === null) return
            childrenOf.set(task.pTaskId, [ ...(childrenOf.get(task.pTaskId) || []), task ])
        })

        const root = taskList.find((task) => task.taskId === rootTaskId)
        if(!root) return []

        const seen = new Set()
        const result = []
        const _walk = (task) => {
            if(seen.has(task.taskId)) return
            seen.add(task.taskId)
            result.push(task)
            ;(childrenOf.get(task.taskId) || []).forEach(_walk)
        }
        _walk(root)
        return result
    }

    // Quantas tarefas internas a instância tem, e em que estado. Cada kind tem
    // uma fonte diferente: desktop reporta as suas ao daemon (cache), enquanto
    // as de um app vivem no task-executor in-process.
    const _CountInstanceTasks = (instance) => {
        try {
            if(instance.kind !== instanceStore.KIND.APP){
                const tasks = instanceTasksCache.get(instance.instanceId)
                return tasks ? _GroupTasksByStatus(tasks) : undefined
            }
            if(!taskExecutorMachineService || instance.taskId === undefined || instance.taskId === null)
                return undefined
            return _GroupTasksByStatus(_CollectTaskSubtree(taskExecutorMachineService.ListTasks(), instance.taskId))
        } catch(e) { return undefined }
    }

    // Amostra UMA instância. Para desktop/cli mede o GRUPO de processos: o
    // daemon lança `run package` detached (pgid = pid) e o Electron sobe seus
    // renderers — medir só o pid registrado mostraria ~0% de CPU.
    //
    // `app` roda in-process no daemon, então não existe medição isolada: o que
    // se reporta é o processo do daemon inteiro, marcado `shared: true` para a
    // interface poder dizer isso ao usuário em vez de fingir precisão.
    const _SampleInstance = (instance, at) => {
        const base = {
            instanceId:  instance.instanceId,
            packagePath: instance.packagePath,
            kind:        instance.kind,
            status:      instance.status,
            pid:         instance.pid,
            at,
            tasksByStatus: _CountInstanceTasks(instance)
        }

        if(!metricsSampler) return { ...base, available: false }

        const isInProcess = instance.kind === instanceStore.KIND.APP
        const sample = isInProcess
            ? metricsSampler.SampleProcess(process.pid)
            : (instance.pid
                ? (metricsSampler.SampleProcessGroup(instance.pid) || metricsSampler.SampleProcess(instance.pid))
                : undefined)

        if(!sample) return { ...base, available: false }

        if(!isInProcess) sampledPidByInstanceId.set(instance.instanceId, instance.pid)

        return { ...base, ...sample, pid: instance.pid ?? sample.pid, available: true, shared: isInProcess }
    }

    // Uma instância desktop REPORTA suas tarefas ao daemon a cada mudança. Se ela
    // foi lançada por um daemon anterior (readotada no restart), esse push nunca
    // aconteceu para este processo, e a contagem ficaria vazia até a próxima
    // mudança de estado dela — que num app estável pode não vir nunca. Um pull
    // pelo socket da instância preenche o cache uma vez.
    const _EnsureInstanceTasksCache = async (instanceList) => {
        const pending = instanceList.filter((instance) =>
            instance.kind !== instanceStore.KIND.APP && !instanceTasksCache.has(instance.instanceId))

        await Promise.all(pending.map(async (instance) => {
            const tasks = await ListInstanceTasks(instance.instanceId)
            if(tasks && tasks.length > 0) instanceTasksCache.set(instance.instanceId, tasks)
        }))
    }

    const _SampleTick = async () => {
        const at = Date.now()

        const system = metricsSampler ? { at, ...metricsSampler.SampleSystem() } : undefined

        let instanceList = []
        try { instanceList = await ListInstances() } catch(e) { instanceList = [] }

        try { await _EnsureInstanceTasksCache(instanceList) } catch(e) {}

        const instances = instanceList.map((instance) => _SampleInstance(instance, at))

        const aliveIds = instances.map((sample) => sample.instanceId)
        if(metricsHistory){
            instances.forEach((sample) => metricsHistory.Push(sample.instanceId, sample))
            metricsHistory.KeepOnly(aliveIds)
        }

        // Linha de base de instância encerrada: sem isto o mapa do sampler
        // cresceria para sempre num daemon que fica meses no ar.
        const aliveIdSet = new Set(aliveIds)
        Array.from(sampledPidByInstanceId.entries())
            .filter(([instanceId]) => !aliveIdSet.has(instanceId))
            .forEach(([instanceId, pid]) => {
                if(metricsSampler) metricsSampler.Forget(pid)
                sampledPidByInstanceId.delete(instanceId)
            })

        lastMetricsSnapshot = { at, system, instances }
        try { metricsEmitter.emit("METRICS_SAMPLE", lastMetricsSnapshot) } catch(e) {}

        // O log só é conferido de tempos em tempos: statar todo tick seria
        // desperdício para um arquivo que leva horas para chegar ao teto.
        sampleTickCount += 1
        if(sampleTickCount % 30 === 0)
            instanceList.forEach((instance) => _TruncateOversizedLog(instance.instanceId))
    }

    const _StartMetricsSampling = () => {
        if(!metricsSampler) {
            _Log("Metrics", "lib de métricas ausente — desempenho não será reportado")
            return
        }
        if(!metricsSampler.IsSupported()) {
            _Log("Metrics", "/proc indisponível neste sistema — desempenho não será reportado")
            return
        }

        // `unref` para o timer não segurar o processo vivo por conta própria.
        metricsTimer = setInterval(() => { _SampleTick().catch(() => {}) }, METRICS_SAMPLE_INTERVAL_MS)
        if(metricsTimer.unref) metricsTimer.unref()
        _SampleTick().catch(() => {})
    }

    // Snapshot atual de todas as instâncias + estado da máquina.
    const ListInstanceMetrics = () => lastMetricsSnapshot

    // Série histórica de UMA instância, para o gráfico. 2 params → objeto.
    const GetInstanceMetrics = ({ instanceId, limit } = {}) => {
        if(!instanceId) throw new Error("GetInstanceMetrics: 'instanceId' é obrigatório.")
        const history = metricsHistory ? metricsHistory.Get(instanceId, limit) : []
        const current = history.length > 0 ? history[history.length - 1] : undefined
        return { instanceId, current, history, sampleIntervalMs: METRICS_SAMPLE_INTERVAL_MS }
    }

    // Stream (WS) das amostras: manda o último snapshot na conexão e, depois,
    // cada nova amostra. Mesmo contrato dos demais streams do daemon.
    const MetricsStream = (ws) => {
        const _send = (snapshot) => { try { ws.send(JSON.stringify(snapshot)) } catch(e){} }

        _send(lastMetricsSnapshot)

        const onSample = (snapshot) => _send(snapshot)
        metricsEmitter.on("METRICS_SAMPLE", onSample)
        ws.on && ws.on("close", () => {
            try { metricsEmitter.removeListener("METRICS_SAMPLE", onSample) } catch(e){}
        })
    }

    const GetMetricsEmitter = () => metricsEmitter

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
    const _RunDesktopInSeparateProcess = async (packagePath, launchedBy, startupParams) => {
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
            META_INSTANCE_TASK_SERVER_NAME: INSTANCE_TASK_SERVER_NAME,
            // Rota inicial da aplicação, quando quem manda abrir sabe ONDE quer
            // chegar: é o que permite um aplicativo abrir outro já na tela certa
            // (o Package Developer manda o Instance Executor abrir direto na
            // instância que acabou de lançar). Chega até o electron-main pelo
            // env, como os demais META_*.
            ...(startupParams && startupParams.initialRoute
                ? { META_INITIAL_ROUTE: String(startupParams.initialRoute) }
                : {}),
            // Socket que o electron-main abre para receber comandos de janela
            // (hoje: foco). Flui daqui → `run` → taskLoader → electron-main.
            META_WINDOW_CONTROL_SOCKET: _CreateInstanceWindowSocketPath(instanceId)
        }
        // Redireciona stdout/stderr do processo para o log da instância (antes ia
        // para "ignore" e sumia). O filho herda o fd; fechamos nossa cópia após o
        // spawn. Se abrir o log falhar, degrada para "ignore" (não bloqueia o launch).
        let logFd
        try {
            const logPath = _EnsureInstanceLogPath(instanceId)
            logFd = fs.openSync(logPath, "a")
            fs.writeSync(logFd, `[${_NowLocalISO()}] [daemon] launching desktop ${packagePath}\n`)
        } catch(e) { logFd = undefined }

        const child = spawn(join(executablesDirPath, "run"), ["package", packagePath], {
            cwd: ECO_DIRPATH_INSTALL_DATA,
            env,
            detached: true,
            stdio: logFd !== undefined ? ["ignore", logFd, logFd] : "ignore"
        })
        if(logFd !== undefined) { try { fs.closeSync(logFd) } catch(e) {} }
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
        child.on("exit", (code, signal) => {
            const registered = desktopProcesses.get(instanceId)
            if(registered && registered.child === child)
                desktopProcesses.delete(instanceId)
            instanceTasksCache.delete(instanceId)
            // Registra o desfecho no log da instância: código de saída e signal
            // eram ignorados antes (o callback nem recebia os argumentos).
            _AppendInstanceLog(instanceId, `[daemon] desktop exited (code=${code}, signal=${signal})`)
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
        // Poda antes de começar a medir: a pasta de logs acumula um arquivo por
        // lançamento e nada os removia.
        await _PruneInstanceLogs().catch(() => {})
        _StartMetricsSampling()
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

    // Resolve os recursos que o pacote DECLARA (socket-params/storage-params) e
    // materializa as pastas antes de executar.
    //
    // Roda DEPOIS do BuildMetadataHierarchy de propósito: o merge por-nó de lá é
    // `{ ...injetado, ...próprio do pacote }`, então o que entra antes é apenas
    // base e perde para um literal esquecido no startup-params.json — justamente
    // o caminho absoluto que este mecanismo existe para eliminar. Aplicado
    // depois, o recurso declarado é a fonte da verdade.
    const _ResolveDeclaredResources = (metadataHierarchy) => {

        if(!ApplyResourceParamsToHierarchy) return metadataHierarchy

        const {
            ECOSYSTEMDATA_CONF_DIRNAME_UNIX_SOCKET_DIR,
            ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR,
            ECOSYSTEMDATA_CONF_DIRNAME_STORAGE_DIR
        } = ecosystemDefaults

        const resolved = ApplyResourceParamsToHierarchy({
            metadataHierarchy,
            installDataDirPath: ECO_DIRPATH_INSTALL_DATA,
            ECOSYSTEMDATA_CONF_DIRNAME_UNIX_SOCKET_DIR,
            ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR,
            ECOSYSTEMDATA_CONF_DIRNAME_STORAGE_DIR
        })

        EnsureResources(resolved.resources)

        resolved.resources
            .filter(({ owner }) => owner)
            .forEach(({ kind, parameter, path }) => _Log("Resources", `${kind} ${parameter} → ${path}`))

        return resolved.metadataHierarchy
    }

    const RunPackage = async ({ packagePath, startupParams, launchedBy }) => {
        try{
            // DESKTOP → processo separado (isola o Electron do daemon).
            // `startupParams` era descartado neste caminho; ele é o que carrega
            // a rota inicial pedida por quem mandou abrir.
            if(await _IsDesktopPackage(packagePath)){
                const instanceId = await _RunDesktopInSeparateProcess(packagePath, launchedBy, startupParams)
                return { instanceId }
            }

            const packageList = await repositoryManagerService.ListPackages()

            // Composição do startupParams injetado (BASE da hierarquia):
            //   ecosystemDefaults  → base do ecossistema (config materializada)
            //   startupParams      → o que o chamador passou sobrepõe o ecossistema
            // O startup-params.json de cada nó ainda sobrepõe ambos, via merge
            // por-nó feito no ReplaceStartupParams do dependency-graph-builder.
            const injected = { ...ecosystemDefaults, ...(startupParams || {}) }

            const metadataHierarchy = _ResolveDeclaredResources(await BuildMetadataHierarchy({
                path: packagePath,
                startupParams: injected,
                packageList,
                REPOS_CONF_EXT_GROUP_DIR,
                PKG_CONF_DIRNAME_METADATA
            }))

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

            // Log por instância do app in-process: não há processo filho para
            // redirecionar stdio, então registramos as transições de estado da
            // execução — incluindo o MOTIVO quando uma tarefa falha (ERROR). É o
            // que torna "terminou sem erro" auditável para apps.
            _AppendInstanceLog(instanceId, `[daemon] launching app ${packagePath} (executionId=${executionId})`)
            environmentRuntimeService.AddExecutionStatusListener(executionId, (status, statusReason) =>
                _AppendInstanceLog(instanceId, `execution status: ${status}${statusReason ? ` — ${statusReason}` : ""}`))

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

    // ───────────── Instâncias EXTERNAS (o daemon não as lançou) ─────────────
    //
    // Um processo iniciado por fora — o caso concreto é o servidor MCP, que o
    // cliente de IA sobe por stdio — não existia para o monitor: `RegisterLaunch`
    // só é chamado por quem o daemon lança. Aqui ele se anuncia e passa a
    // aparecer, com a identidade da execução (versão, origem do binário, commit).
    //
    // O daemon NÃO passa a ser dono do processo: parar/focar continuam sendo de
    // quem o iniciou. O `kind: external` é o que diz isso ao painel.
    const AttachExternalInstance = async ({ packagePath, pid, launchedBy, identity } = {}) => {
        if(!packagePath) throw new Error("AttachExternalInstance: 'packagePath' é obrigatório.")
        const instanceId = _CreateInstanceId()
        const registered = await _SafeStore(() => instanceStore.AttachExternal({
            instanceId, packagePath, pid, launchedBy, identity
        }))
        if(!registered) throw new Error("Não foi possível registrar a instância externa.")
        _AppendInstanceLog(instanceId, `[daemon] external attach ${packagePath} (pid ${pid || "?"})`)
        _EmitInstancesChange()
        return { attached: true, instanceId }
    }

    // O processo externo avisando que terminou. Se ele morrer sem avisar, o
    // Reconcile/ListInstances derrubam o registro pelo pid — este caminho só
    // torna o encerramento imediato.
    const DetachExternalInstance = async (instanceId) => {
        if(!instanceId) throw new Error("DetachExternalInstance: 'instanceId' é obrigatório.")
        await _SafeStore(() => instanceStore.MarkStopped({ instanceId }))
        _AppendInstanceLog(instanceId, "[daemon] external detach")
        _EmitInstancesChange()
        return { detached: true, instanceId }
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

    // Traz para frente a janela de UMA instância desktop. É o que permite ao
    // painel dar FOCO num aplicativo já aberto em vez de abrir outra instância.
    // Fala com o socket de controle de janela publicado pelo electron-main.
    // 1 parâmetro (instanceId) chega como valor direto (contrato do server-manager).
    const FocusInstance = async (instanceId) => {
        if(!instanceId) throw new Error("FocusInstance: 'instanceId' é obrigatório")

        const instance = await _SafeStore(() => instanceStore.Get({ instanceId }))
        if(!instance) throw new Error(`Instância não encontrada: ${instanceId}`)

        // Só instâncias DESKTOP têm janela. Para as demais não há o que focar —
        // devolvemos o resultado negativo em vez de erro (o chamador decide).
        if(instance.kind !== instanceStore.KIND.DESKTOP)
            return { focused: false, instanceId }

        try {
            const result = await _HttpOverSocket({
                socketPath: _CreateInstanceWindowSocketPath(instanceId),
                method: "POST",
                path: "/focus"
            })
            return { focused: Boolean(result && result.focused), instanceId }
        } catch(e) {
            // Socket ausente/morto: instância encerrando, ou lançada por uma
            // versão do taskLoader anterior a este canal.
            return { focused: false, instanceId }
        }
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
            return { ...instance, status: "ACTIVE", installedVersion: _InstalledVersion(instance) }
        }))

        return instanceList.filter(Boolean)
    }

    // Versão que está NO DISCO agora, para o painel comparar com a que está
    // rodando e dizer "desatualizada" sem obrigar ninguém a conferir número
    // (IEXP-28). Só faz sentido para quem registrou identidade no attach.
    const _InstalledVersion = (instance) => {
        if(!instance || !instance.identity || !instance.identity.packagePath) return undefined
        const read = (file) => {
            try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch(e){ return undefined }
        }
        const meta = read(join(instance.identity.packagePath, "metadata", "package.json"))
        const npm = read(join(instance.identity.packagePath, "package.json"))
        return (meta && meta.version) || (npm && npm.version) || undefined
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
        AttachExternalInstance,
        DetachExternalInstance,
        FocusInstance,
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

        // Observabilidade: log e desempenho por instância.
        ReadInstanceLog,
        InstanceLogStream,
        ListInstanceLogs,
        ListInstanceMetrics,
        GetInstanceMetrics,
        MetricsStream,
        GetMetricsEmitter,

        GetTaskExecutorEventEmitter: environmentRuntimeService.GetTaskExecutorEventEmitter
    }

}

module.exports = EcosystemManager