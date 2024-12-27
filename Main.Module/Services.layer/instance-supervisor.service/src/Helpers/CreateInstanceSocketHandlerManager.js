
const crypto = require('crypto')
const EventEmitter = require('node:events')

const NEW_EVENT = Symbol()

const CreateMonitoringStateKey = (socketFilePath) => {
    const hash = crypto.createHash("sha256")
    hash.update(socketFilePath)
    return hash.digest('hex')
}


const CreateSocketMonitoringState = require("./CreateSocketMonitoringState")

const CreateInstanceSocketHandlerManager = ({
    helpers
}) => {

    const allMonitoringState = {}

    const eventEmitter = new EventEmitter()

    const InitializeSocketMonitoring = (socketFilePath) => {

        const monitoringStateKey = CreateMonitoringStateKey(socketFilePath)
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

    const Overview = () => {
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

    const AddEventListener = (f) => 
        eventEmitter.on(NEW_EVENT, f)

    const GetSocketMonitoringState = 
        (monitoringStateKey) => allMonitoringState[monitoringStateKey]

    return {
        InitializeSocketMonitoring,
        TryInitializeSocketMonitoring,
        IsSocketBeingMonitored,
        Overview,
        GetMonitoringKeys: () => Object.keys(allMonitoringState),
        AddEventListener,
        GetSocketMonitoringState
    }
}

module.exports = CreateInstanceSocketHandlerManager