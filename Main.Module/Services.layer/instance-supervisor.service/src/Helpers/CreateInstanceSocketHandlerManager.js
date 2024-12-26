const CreateInstanceSocketHandlerManager = () => {

    let monitoredSocketFileNames = []

    const StartSocketMonitoring = (socketFileName) => {

        if(!IsSocketBeingMonitored(socketFileName)){
            monitoredSocketFileNames.push(socketFileName)
        } else {
            throw `${socketFileName} já está sendo monitorado!`
        }

    }

    const TryStartSocketMonitoring = (socketFileName) => {
        if(!IsSocketBeingMonitored(socketFileName)){
            monitoredSocketFileNames.push(socketFileName)
        }
    }

    const IsSocketBeingMonitored = (socketFileName) =>
        monitoredSocketFileNames.indexOf(socketFileName) > -1

    const MonitoringOverview = () => {
        return monitoredSocketFileNames
        .reduce((acc, socketFileName) => {
            return {
                ...acc,
                [socketFileName]:{}
            }
        }, {})
    }

    return {
        StartSocketMonitoring,
        TryStartSocketMonitoring,
        IsSocketBeingMonitored,
        MonitoringOverview,
        GetMonitoredSocketFileNames: () => monitoredSocketFileNames
    }
}

module.exports = CreateInstanceSocketHandlerManager