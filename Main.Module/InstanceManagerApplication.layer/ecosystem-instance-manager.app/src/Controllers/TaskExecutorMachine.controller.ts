const TaskExecutorMachineController = (params: any) => {
    
    const { 
        taskExecutorMachineService
    } = params


    const TaskStatusChange = (ws: any) => {
        taskExecutorMachineService
        .GetTaskExecutorEventEmitter()
        .on("TASK_STATUS_CHANGE", ({ taskId, status, objectLoaderType }: any) => {
            try{
                ws.send(JSON.stringify({ taskId, status, objectLoaderType }))
            }catch(e: any){
                Log.error("TaskExecutorMachine", e)
            }
        })
    }
    
    const controllerServiceObject = {
        controllerName : "TaskExecutorMachineController",
        CreateTasks: (executionParams: any) => {
            return taskExecutorMachineService.CreateTasks(executionParams)
        },
        ListTasks: taskExecutorMachineService.ListTasks,
        GetTask: taskExecutorMachineService.GetTask,
        // 1 parâmetro (taskIds) chega como valor direto (contrato do server-manager).
        StopTasks: (taskIds: any) => taskExecutorMachineService.StopTasks(taskIds),
        TaskStatusChange
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = TaskExecutorMachineController