

const CreateSocketMonitoringState = () => {
    return {

    }
}

const CreateInstanceSocketHandlerManager = () => {

    let monitoredSocketFilePaths = []

    const StartSocketMonitoring = (socketFilePath) => {

        if(!IsSocketBeingMonitored(socketFilePath)){
            monitoredSocketFilePaths.push(socketFilePath)
        } else {
            throw `${socketFilePath} já está sendo monitorado!`
        }

    }

    const TryStartSocketMonitoring = (socketFilePath) => {
        if(!IsSocketBeingMonitored(socketFilePath)){
            monitoredSocketFilePaths.push(socketFilePath)
        }
    }

    const IsSocketBeingMonitored = (socketFilePath) =>
        monitoredSocketFilePaths.indexOf(socketFilePath) > -1

    const MonitoringOverview = () => {
        return monitoredSocketFilePaths
        .reduce((acc, socketFilePath) => {
            return {
                ...acc,
                [socketFilePath]:{}
            }
        }, {})
    }

    return {
        StartSocketMonitoring,
        TryStartSocketMonitoring,
        IsSocketBeingMonitored,
        MonitoringOverview,
        GetMonitoredSocketFilePaths: () => monitoredSocketFilePaths
    }
}

module.exports = CreateInstanceSocketHandlerManager