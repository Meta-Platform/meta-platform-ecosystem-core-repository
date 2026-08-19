
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

    /*
        Deixar de monitorar tem de DESLIGAR o que estava ligado.

        Só apagar a entrada do mapa não bastaria: o estado de monitoramento tem
        temporizador de health check, temporizador de reconexão e um canal gRPC
        aberto, e todos os três seguem vivos por conta própria. Sem `Destroy`, um
        socket removido continuaria batendo a cada 4 s para sempre, invisível
        para quem olha o overview.
    */
    const RemoveSocketMonitoring = (socketFilePath: string) => {
        const monitoringStateKey = CreateMonitoringStateKey(socketFilePath)
        const monitoringState = allMonitoringState[monitoringStateKey]
        if(!monitoringState) return
        delete allMonitoringState[monitoringStateKey]
        if(typeof monitoringState.Destroy === "function") monitoringState.Destroy()
        eventEmitter.emit(NEW_EVENT)
    }

    const _GetMonitoringStateByKey = (monitoringStateKey: string) => allMonitoringState[monitoringStateKey]
    const _GetMonitoringKeys = () => Object.keys(allMonitoringState)

    const IsSocketBeingMonitored = (monitoringStateKey: string) => !!_GetMonitoringStateByKey(monitoringStateKey)

    /*
        "Existe conversa acontecendo com a instância deste arquivo AGORA?"

        É o veto que a reconciliação de órfãos consulta antes de cogitar apagar
        qualquer coisa: enquanto o supervisor fala com a instância, o arquivo é
        dela, ponto final.
    */
    const IsSocketConnected = (socketFilePath: string) => {
        const monitoringState = _GetMonitoringStateByKey(CreateMonitoringStateKey(socketFilePath))
        if(!monitoringState) return false
        return monitoringState.GetCommunicationStatus() === "CONNECTED"
    }

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
        RemoveSocketMonitoring,
        IsSocketBeingMonitored,
        IsSocketConnected,
        Overview,
        GetMonitoringKeysReady,
        AddEventListener,
        GetSocketMonitoringState: _GetMonitoringStateByKey
    }
}

module.exports = CreateInstanceSocketHandlerManager