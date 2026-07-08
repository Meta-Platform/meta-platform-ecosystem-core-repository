const TaskExecutorMachineController = (params) => {
    
    const { 
        taskExecutorMachineService
    } = params


    const TaskStatusChange = (ws) => {
        taskExecutorMachineService
        .GetTaskExecutorEventEmitter()
        .on("TASK_STATUS_CHANGE", ({ taskId, status, objectLoaderType }) => {
            try{
                ws.send(JSON.stringify({ taskId, status, objectLoaderType }))
            }catch(e){
                console.log(e)
            }
        })
    }
    
    const controllerServiceObject = {
        controllerName : "TaskExecutorMachineController",
        CreateTasks: (executionParams) => {
            return taskExecutorMachineService.CreateTasks(executionParams)
        },
        ListTasks: taskExecutorMachineService.ListTasks,
        GetTask: taskExecutorMachineService.GetTask,
        // 1 parâmetro (taskIds) chega como valor direto (contrato do server-manager).
        StopTasks: (taskIds) => taskExecutorMachineService.StopTasks(taskIds),
        TaskStatusChange
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = TaskExecutorMachineController