const EventEmitter = require('node:events')

const MonitoringStateTypes = Object.freeze({
    CREATED: "CREATED",
    CONNECTING: "CONNECTING",
    CONNECTED : "CONNECTED",
    UNAVAILABLE: "UNAVAILABLE"
})

const CreateSocketMonitoringState = ({
    socketFilePath,
    helpers
}) => {
    
    const eventEmitter = new EventEmitter()

    const { CreateCommunicationInterface } = helpers

    const CONNECTION_STATUS_CHANGE = Symbol()

    let communicationStatus = MonitoringStateTypes.CREATED
    let communicationClient = undefined

    const _ChangeStatus = (newStatus) => {
        communicationStatus = newStatus
        eventEmitter.emit(CONNECTION_STATUS_CHANGE, newStatus)
    }

    const _ConnectInstance =  async () => {
        try{
            _ChangeStatus(MonitoringStateTypes.CONNECTING)
            const instanceCommunicationClient = await CreateCommunicationInterface(socketFilePath)
            communicationClient = instanceCommunicationClient
            _ChangeStatus(MonitoringStateTypes.CONNECTED)
        }catch(e){
            _ChangeStatus(MonitoringStateTypes.UNAVAILABLE)
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