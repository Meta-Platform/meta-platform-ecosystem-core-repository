const EnvironmentRuntimeController = (params: any) => {

    const { 
        environmentRuntimeService
    } = params

    const ExecutionStatusChange = (ws: any, executionId: any) => {
        const executionData = environmentRuntimeService
            .GetExecutionData(executionId)

        ws.send(JSON.stringify({ 
            executionId: executionData.executionId, 
            status: executionData.status
        }))

        environmentRuntimeService
            .AddExecutionStatusListener(executionId, (status: any) => {
                try{
                    ws.send(JSON.stringify({ executionId, status }))
                }catch(e: any){
                    Log.error("EnvironmentRuntime", e)
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