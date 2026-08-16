
const crypto = require('crypto') as typeof import('crypto')
const EventEmitter = require('node:events') as typeof import('node:events')

const NEW_EVENT = Symbol()

const CreateMonitoringStateKey = (socketFilePath: string): string => {
    const hash = crypto.createHash("sha256")
    hash.update(socketFilePath)
    return hash.digest('hex')
}

const CreateSocketMonitoringState = require("./CreateSocketMonitoringState") as (options: { socketFilePath: string, helpers: any }) => any

const CreateInstanceSocketHandlerManager = ({
    helpers
}: { helpers: any }) => {

    const allMonitoringState: Record<string, any> = {}

    const eventEmitter = new EventEmitter()

    const InitializeSocketMonitoring = (socketFilePath: string) => {

        const monitoringStateKey = CreateMonitoringStateKey(socketFilePath)
        if(!IsSocketBeingMonitored(monitoringStateKey)){
            const monitoringState = CreateSocketMonitoringState({socketFilePath, helpers})
            allMonitoringState[monitoringStateKey] = monitoringState
            monitoringState.ConnectionStatusListener(() =>  eventEmitter.emit(NEW_EVENT))
        } else {
            throw `${socketFilePath} já está sendo monitorado!`
        }
    }

    const TryInitializeSocketMonitoring = (socketFilePath: string) => {
        try {
            InitializeSocketMonitoring(socketFilePath)
        } catch(e){
            Log.error("CreateInstanceSocketHandlerManager", e)
        }
    }

    const _GetMonitoringStateByKey = (monitoringStateKey: string) => allMonitoringState[monitoringStateKey]
    const _GetMonitoringKeys = () => Object.keys(allMonitoringState)

    const IsSocketBeingMonitored = (monitoringStateKey: string) => !!_GetMonitoringStateByKey(monitoringStateKey)

    const Overview = () => {
        return _GetMonitoringKeys()
        .reduce((acc: Record<string, unknown>, monitoringStateKey: string) => {

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

    const AddEventListener = (f: (...args: any[]) => void) => 
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