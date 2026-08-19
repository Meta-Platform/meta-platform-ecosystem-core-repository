const EventEmitter = require('node:events') as typeof import('node:events')

const MonitoringStateTypes = Object.freeze({
    CREATED: "CREATED",
    CONNECTING: "CONNECTING",
    CONNECTED : "CONNECTED",
    UNAVAILABLE: "UNAVAILABLE"
})

// Monitoramento contínuo da saúde da instância + reconexão. Sem isto, uma vez
// CONNECTED o status nunca mudava — quando o processo morria, o painel continuava
// mostrando o socket como vivo.
const HEALTH_CHECK_INTERVAL_MS = 4000
const RECONNECT_INTERVAL_MS    = 4000

const CreateSocketMonitoringState = ({
    socketFilePath,
    helpers
}: {
    socketFilePath: string
    helpers: { CreateCommunicationInterface: (socketFilePath: string) => Promise<any> }
}) => {

    const eventEmitter = new EventEmitter()

    const { CreateCommunicationInterface } = helpers

    const CONNECTION_STATUS_CHANGE = Symbol()

    let communicationStatus: string = MonitoringStateTypes.CREATED
    let communicationClient: any = undefined
    let healthTimer: NodeJS.Timeout | undefined    = undefined
    let reconnectTimer: NodeJS.Timeout | undefined = undefined
    let destruido: boolean = false

    const _ChangeStatus = (newStatus: string) => {
        if(communicationStatus === newStatus) return
        communicationStatus = newStatus
        eventEmitter.emit(CONNECTION_STATUS_CHANGE, newStatus)
    }

    const _StopHealthCheck = () => {
        if(healthTimer){ clearInterval(healthTimer); healthTimer = undefined }
    }

    const _StopReconnect = () => {
        if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = undefined }
    }

    /*
        Descartar o cliente é FECHAR o cliente, não apenas soltar a variável.

        Cada cliente carrega um canal gRPC, e o canal se mantém vivo por conta
        própria: resolver, load balancer, subcanal e um temporizador de backoff
        que continua tentando reconectar mesmo depois que ninguém mais o
        referencia. Enquanto ele não for fechado, nada disso é coletado.

        Aqui isso importava mais do que em qualquer outro lugar, porque este
        arquivo é o único que abre cliente EM LAÇO: a reconexão roda a cada 4 s
        enquanto a instância não responder, e o diretório de sockets guarda
        arquivos de instâncias que já morreram. Cada tentativa contra um desses
        deixava um canal imortal; o `host-agent.app`, que monitora todos os
        sockets do host, crescia ~100 MiB/h parado por causa disso.
    */
    const _DescartarCliente = () => {
        if(!communicationClient) return
        const clienteAntigo = communicationClient
        communicationClient = undefined
        if(typeof clienteAntigo.Close === "function") clienteAntigo.Close()
    }

    // Enquanto CONNECTED, um GetStatus periódico (RPC leve). Se falhar, o processo
    // morreu -> marca UNAVAILABLE (dispara a atualização do overview) e reconecta.
    const _StartHealthCheck = () => {
        _StopHealthCheck()
        healthTimer = setInterval(async () => {
            if(communicationStatus !== MonitoringStateTypes.CONNECTED || !communicationClient) return
            try {
                await communicationClient.GetStatus()
            } catch(e) {
                _StopHealthCheck()
                _DescartarCliente()
                _ChangeStatus(MonitoringStateTypes.UNAVAILABLE)
                _ScheduleReconnect()
            }
        }, HEALTH_CHECK_INTERVAL_MS)
    }

    // Tenta reconectar periodicamente (recupera quando o processo volta). Falhas
    // de reconexão mantêm UNAVAILABLE sem re-emitir evento (sem spam de overview).
    const _ScheduleReconnect = () => {
        if(reconnectTimer) return
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined
            if(communicationStatus !== MonitoringStateTypes.CONNECTED) _ConnectInstance()
        }, RECONNECT_INTERVAL_MS)
    }

    const _ConnectInstance =  async () => {
        try{
            if(communicationStatus === MonitoringStateTypes.CREATED)
                _ChangeStatus(MonitoringStateTypes.CONNECTING)
            const instanceCommunicationClient = await CreateCommunicationInterface(socketFilePath)
            // Um cliente anterior que tenha sobrado sai daqui fechado: sem isto,
            // toda reconexão bem-sucedida deixaria o canal antigo para trás.
            _DescartarCliente()
            if(destruido){
                // O monitoramento foi encerrado enquanto a conexão subia. O
                // cliente recém-aberto não tem mais dono — fechar agora, senão
                // ele sobrevive ao próprio estado que o pediu.
                if(typeof instanceCommunicationClient.Close === "function") instanceCommunicationClient.Close()
                return
            }
            communicationClient = instanceCommunicationClient
            _ChangeStatus(MonitoringStateTypes.CONNECTED)
            _StartHealthCheck()
        }catch(e){
            _DescartarCliente()
            _ChangeStatus(MonitoringStateTypes.UNAVAILABLE)
            if(!destruido) _ScheduleReconnect()
        }

    }

    const ConnectionStatusListener = (f: (status: string) => void) =>
        eventEmitter.on(CONNECTION_STATUS_CHANGE, f)

    /*
        Encerra o monitoramento deste socket: para os dois temporizadores, fecha
        o canal e desliga os ouvintes. Sem isto, deixar de monitorar um socket
        não parava nada — o health check e a reconexão continuavam batendo, e o
        canal continuava aberto, num estado que ninguém mais consultava.
    */
    const Destroy = () => {
        if(destruido) return
        destruido = true
        _StopHealthCheck()
        _StopReconnect()
        _DescartarCliente()
        eventEmitter.removeAllListeners()
    }

    _ConnectInstance()

    return {
        GetSocketFilePath: () => socketFilePath,
        GetCommunicationClient: () => communicationClient,
        GetCommunicationStatus: () => communicationStatus,
        ConnectionStatusListener,
        Destroy
    }
}


module.exports = CreateSocketMonitoringState
