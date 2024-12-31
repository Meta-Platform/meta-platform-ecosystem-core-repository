
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

    const _GetMonitoringStateByKey = (monitoringStateKey) => allMonitoringState[monitoringStateKey]
    const _GetMonitoringKeys = () => Object.keys(allMonitoringState)

    const IsSocketBeingMonitored = (monitoringStateKey) => !!_GetMonitoringStateByKey(monitoringStateKey)

    const Overview = () => {
        return _GetMonitoringKeys()
        .reduce((acc, monitoringStateKey) => {

            const monitoringState = _GetMonitoringStateByKey(monitoringStateKey)

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

    const GetMonitoringKeysReady = () => 
        _GetMonitoringKeys()
        .filter((key) => {
            const { GetCommunicationStatus } = _GetMonitoringStateByKey(key)
            return GetCommunicationStatus() === "CONNECTED"
        })

    return {
        InitializeSocketMonitoring,
        TryInitializeSocketMonitoring,
        IsSocketBeingMonitored,
        Overview,
        GetMonitoringKeysReady,
        AddEventListener,
        GetSocketMonitoringState: _GetMonitoringStateByKey
    }
}

module.exports = CreateInstanceSocketHandlerManager