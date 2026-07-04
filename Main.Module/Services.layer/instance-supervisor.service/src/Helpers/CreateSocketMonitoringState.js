const EventEmitter = require('node:events')

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
}) => {

    const eventEmitter = new EventEmitter()

    const { CreateCommunicationInterface } = helpers

    const CONNECTION_STATUS_CHANGE = Symbol()

    let communicationStatus = MonitoringStateTypes.CREATED
    let communicationClient = undefined
    let healthTimer    = undefined
    let reconnectTimer = undefined

    const _ChangeStatus = (newStatus) => {
        if(communicationStatus === newStatus) return
        communicationStatus = newStatus
        eventEmitter.emit(CONNECTION_STATUS_CHANGE, newStatus)
    }

    const _StopHealthCheck = () => {
        if(healthTimer){ clearInterval(healthTimer); healthTimer = undefined }
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
                communicationClient = undefined
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
            communicationClient = instanceCommunicationClient
            _ChangeStatus(MonitoringStateTypes.CONNECTED)
            _StartHealthCheck()
        }catch(e){
            communicationClient = undefined
            _ChangeStatus(MonitoringStateTypes.UNAVAILABLE)
            _ScheduleReconnect()
        }

    }

    const ConnectionStatusListener = (f) =>
        eventEmitter.on(CONNECTION_STATUS_CHANGE, f)

    _ConnectInstance()

    return {
        GetSocketFilePath: () => socketFilePath,
        GetCommunicationClient: () => communicationClient,
        GetCommunicationStatus: () => communicationStatus,
        ConnectionStatusListener
    }
}


module.exports = CreateSocketMonitoringState
