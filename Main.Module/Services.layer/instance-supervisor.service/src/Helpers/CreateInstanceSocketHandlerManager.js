
const crypto = require('crypto')

const CreateMonitoringStateKey = (socketFilePath) => {
    const hash = crypto.createHash("sha256")
    hash.update(socketFilePath)
    return hash.digest('hex')
}
  

const CreateSocketMonitoringState = (socketFilePath) => {

    return {
        GetSocketFilePath: () => socketFilePath
    }
}

const CreateInstanceSocketHandlerManager = () => {

    const allMonitoringState = {}

    let monitoredSocketFilePaths = []

    const InitializeSocketMonitoring = (socketFilePath) => {

        const monitoringStateKey = CreateMonitoringStateKey(socketFilePath)

        if(!IsSocketBeingMonitored(monitoringStateKey)){
            allMonitoringState[monitoringStateKey] = CreateSocketMonitoringState(socketFilePath)
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
                    filePath: monitoringState.GetSocketFilePath()
                }
            }
        }, {})
    }

    return {
        InitializeSocketMonitoring,
        TryInitializeSocketMonitoring,
        IsSocketBeingMonitored,
        MonitoringOverview,
        GetMonitoringKeys: () => Object.keys(allMonitoringState)
    }
}

module.exports = CreateInstanceSocketHandlerManager