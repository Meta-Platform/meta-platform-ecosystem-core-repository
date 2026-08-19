const path = require("path")
const EventEmitter = require('node:events')

const INSTANCE_OVERVIEW_CHANGE_EVENT = Symbol()  

const InstancesSupervisorController = (params: any) => {

    const eventEmitter  = new EventEmitter()

    const {
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        instanceMonitoringManager,
        ecosystemdataHandlerService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    
    // Faltava a declaração: `supervisorSocketsDirPath` era atribuída solta e ia
    // parar no objeto global. Declarada no escopo do controller, que é onde ela
    // é lida logo abaixo.
    let supervisorSocketsDirPath: any

    const _InitSupervisorSocketsDirPath = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        supervisorSocketsDirPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)
    }

    _InitSupervisorSocketsDirPath()

    instanceMonitoringManager.OverviewChangeListener(() => eventEmitter.emit(INSTANCE_OVERVIEW_CHANGE_EVENT))

    /*
        Um ouvinte por conexão — e ele TEM de sair quando a conexão sai.

        Ficava. O `LogStreaming`, logo abaixo, sempre desligou o seu no "close";
        este nunca desligou, e é o mais caro dos dois: o ouvinte chama
        `GetOverview()`, que MONTA um retrato novo a cada disparo. Com N ouvintes
        mortos acumulados, todo evento de mudança montava N retratos e tentava
        `send` em N sockets fechados.

        E o evento não é raro: ele sai a cada mudança de status de conexão de
        instância, e o health check de cada socket roda a cada 4 s, com reconexão
        também a cada 4 s. Basta uma aba recarregada algumas vezes para o custo
        virar permanente.

        Foi o que levou o `host-agent.app` — que serve o inventário do host a
        todos os painéis, e por isso é quem mais recebe conexão — a 1,87 GiB em
        16h45, crescendo com a ATIVIDADE e parado em repouso. O registro em
        `docs/incongruencias/host-agent-app--heap-cresce-sem-parar.md` levantava
        duas hipóteses (retenção real x V8 sem pressão) e dizia que só um heap
        snapshot decidiria. É a primeira: retenção real, e está aqui.

        Ouve "close" e "error": socket que morre por erro nem sempre emite
        "close" depois.
    */
    const InstanceOverviewChange = (ws: any) => {

        const Emitir = () => {
            try{
                const overviewData = instanceMonitoringManager.GetOverview()
                ws.send(JSON.stringify(overviewData))
            }catch(e: any){
                Log.error("InstancesSupervisor", e)
            }
        }

        eventEmitter.on(INSTANCE_OVERVIEW_CHANGE_EVENT, Emitir)

        let encerrado = false
        const Encerrar = () => {
            if(encerrado) return
            encerrado = true
            eventEmitter.off(INSTANCE_OVERVIEW_CHANGE_EVENT, Emitir)
        }
        ws.on && ws.on("close", Encerrar)
        ws.on && ws.on("error", Encerrar)
    }

    // Streaming de log do processo via socket: conecta no LogStreaming do
    // package-executor e repassa cada mensagem para o websocket do navegador.
    const LogStreaming = (ws: any, monitoringStateKey: any) => {
        let logStreaming: any
        const _safeSend = (payload: any) => { try { ws.send(JSON.stringify(payload)) } catch(e: any){} }
        const _cleanup = () => {
            try {
                if(!logStreaming) return
                if(typeof logStreaming.cancel === "function") logStreaming.cancel()
                else if(typeof logStreaming.destroy === "function") logStreaming.destroy()
            } catch(e: any){}
        }
        try {
            logStreaming = instanceMonitoringManager.GetLogStreaming(monitoringStateKey)
            logStreaming.on("data",  (logData: any) => _safeSend(logData))
            logStreaming.on("error", (error: any)  => _safeSend({ message: `[erro] ${(error && error.message) || error}` }))
            logStreaming.on("end",   ()        => _safeSend({ message: "[stream encerrado]" }))
        } catch(e: any) {
            _safeSend({ message: `[erro] ${(e && e.message) || e}` })
        }
        ws.on && ws.on("close", _cleanup)
    }

    const controllerServiceObject = {
        controllerName         : "InstancesSupervisorController",
        ListMonitoringKeys     : instanceMonitoringManager.GetMonitoringKeysReady,
        Overview               : instanceMonitoringManager.GetOverview,
        ListInstanceTasks      : instanceMonitoringManager.ListInstanceTasks,
        GetTaskInformation     : instanceMonitoringManager.GetTaskInformation,
        GetStartupArguments    : instanceMonitoringManager.GetStartupArguments,
        GetProcessInformation  : instanceMonitoringManager.GetProcessInformation,
        KillInstance           : instanceMonitoringManager.KillInstance,
        InstanceOverviewChange,
        LogStreaming
    }
    return Object.freeze(controllerServiceObject)
    
}

module.exports = InstancesSupervisorController