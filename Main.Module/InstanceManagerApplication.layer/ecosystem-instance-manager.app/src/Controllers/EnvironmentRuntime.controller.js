const EnvironmentRuntimeController = (params) => {

    const { 
        environmentRuntimeService
    } = params

    const ExecutionStatusChange = (ws, executionId) => {
        const executionData = environmentRuntimeService
            .GetExecutionData(executionId)

        ws.send(JSON.stringify({ 
            executionId: executionData.executionId, 
            status: executionData.status
        }))

        environmentRuntimeService
            .AddExecutionStatusListener(executionId, (status) => {
                try{
                    ws.send(JSON.stringify({ executionId, status }))
                }catch(e){
                    console.log(e)
                }
            })
    }

    const controllerServiceObject = {
        controllerName : "EnvironmentRuntimeController",
        ExecuteEnvironment: environmentRuntimeService.ExecuteEnvironment,
        ListRunningEnvironments: environmentRuntimeService.ListRunningEnvironments,
        ExecutionStatusChange,
        StopExecution: environmentRuntimeService.StopExecution
    }

    return Object.freeze(controllerServiceObject)
}


module.exports = EnvironmentRuntimeController