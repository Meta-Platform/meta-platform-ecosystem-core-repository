
const crypto = require('crypto')
const EventEmitter = require('node:events')


const MonitoringStateTypes = Object.freeze({
    CREATED: "CREATED",
    CONNECTING: "CONNECTING",
    CONNECTED : "CONNECTED"
})

const CreateMonitoringStateKey = (socketFilePath) => {
    const hash = crypto.createHash("sha256")
    hash.update(socketFilePath)
    return hash.digest('hex')
}
  

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
        _ChangeStatus(MonitoringStateTypes.CONNECTING)
        const instanceCommunicationClient = await CreateCommunicationInterface(socketFilePath)
        communicationClient = instanceCommunicationClient
        _ChangeStatus(MonitoringStateTypes.CONNECTED)
    }

    const ConnectionStatusListener = (f) => 
        eventEmitter.on(CONNECTION_STATUS_CHANGE, (event) => f(event))

    _ConnectInstance()

    return {
        GetSocketFilePath: () => socketFilePath,
        GetCommunicationClient: () => communicationClient,
        GetCommunicationStatus: () => communicationStatus,
        ConnectionStatusListener
    }
}

const CreateInstanceSocketHandlerManager = ({
    helpers
}) => {

    const allMonitoringState = {}

    const eventEmitter = new EventEmitter()

    const InitializeSocketMonitoring = (socketFilePath) => {

        const monitoringStateKey = CreateMonitoringStateKey(socketFilePath)
        const NEW_EVENT = Symbol()
        if(!IsSocketBeingMonitored(monitoringStateKey)){
            const monitoringState = CreateSocketMonitoringState({socketFilePath, helpers})
            allMonitoringState[monitoringStateKey] = monitoringState
            monitoringState.ConnectionStatusListener(() =>  eventEmitter.emit(NEW_EVENT))

        } else {
            throw `${socketFilePath} já está sendo monitorado!`
        }

    }

    const TryInitializeSocketMonitoring = (socketFilePath) => {
        try {
            InitializeSocketMonitoring(socketFilePath)
        } catch(e){
            console.log(e)
        }
    }

    const IsSocketBeingMonitored = (monitoringStateKey) => !!allMonitoringState[monitoringStateKey]

    const MonitoringOverview = () => {
        return Object.keys(allMonitoringState)
        .reduce((acc, monitoringStateKey) => {

            const monitoringState = allMonitoringState[monitoringStateKey]

            return {
                ...acc,
                [monitoringStateKey]:{
                    filePath: monitoringState.GetSocketFilePath(),
                    status: monitoringState.GetCommunicationStatus()
                }
            }
        }, {})
    }

    const AddNewEventListener = (f) => 
        eventEmitter.on(NEW_EVENT, () => f())

    const GetSocketMonitoringState = 
        (monitoringStateKey) => allMonitoringState[monitoringStateKey]

    return {
        InitializeSocketMonitoring,
        TryInitializeSocketMonitoring,
        IsSocketBeingMonitored,
        MonitoringOverview,
        GetMonitoringKeys: () => Object.keys(allMonitoringState),
        AddNewEventListener,
        GetSocketMonitoringState
    }
}

module.exports = CreateInstanceSocketHandlerManager