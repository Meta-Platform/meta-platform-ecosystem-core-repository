const StandardTaskExecutorMachineService = (params) => {

    const { 
        applicationInstanceLib,
        installNodejsPackageDependenciesLib,
        nodejsPackageLib,
        serviceInstanceLib,
        endpointInstanceLib,
        commandApplicationLib, 
        taskExecutorLib,
        utilitiesLib,
        onReady 
    } = params

    const taskLoaders = {
        'install-nodejs-package-dependencies' : installNodejsPackageDependenciesLib.require("InstallNodejsPackageDependencies.taskLoader"),
        'nodejs-package'                      : nodejsPackageLib.require("NodeJSPackage.taskLoader"),
        'command-application'                 : commandApplicationLib.require("CommandApplication.taskLoader"),
        'application-instance'                : applicationInstanceLib.require("ApplicationInstance.taskLoader"),
        'service-instance'                    : serviceInstanceLib.require("ServiceInstance.taskLoader"),
        'endpoint-instance'                   : endpointInstanceLib.require("EndpointInstance.taskLoader")
    }

    const FormatTaskForOutput = utilitiesLib.require("FormatTaskForOutput")
    const GetTaskInformation  = utilitiesLib.require("GetTaskInformation") 
    const TaskExecutor        = taskExecutorLib.require("TaskExecutor")

    const taskExecutor = TaskExecutor({
        taskLoaders
    })
    
    const _GetTask = (taskId) => {
        const task = taskExecutor.GetTask(taskId)
        return GetTaskInformation(task)
    }

    const _ListTasks = () => 
        taskExecutor
            .ListTasks()
            .map((task) => FormatTaskForOutput(task))

    const _ListTasksHierarchically = () => {
        const _filterTasks = (predicate) => taskExecutor.ListTasks().filter(predicate)
        const _getAllMainTasks = () => _filterTasks(({pTaskId}) => !pTaskId)
        const _getTasksChildren = (taskId) => _filterTasks(({pTaskId}) => taskId === pTaskId)
        const _convertListToHierarchy = (list) => {
            return list
                    .reduce((hierarchyAcc, task) => {
                        return {
                            ...hierarchyAcc,
                            [task.taskId]: {
                                task,
                                children: _convertListToHierarchy(_getTasksChildren(task.taskId), )
                            }
                        }
                }, {})
        }

        const hierarchy = _convertListToHierarchy(_getAllMainTasks())
        return hierarchy
    }

    onReady()
    
    return {
        GetTask                     : _GetTask,
        ListTasks                   : _ListTasks,
        ListTasksHierarchically     : _ListTasksHierarchically,
        AddTaskStatusListener       : taskExecutor.AddTaskStatusListener,
        CreateTasks                 : taskExecutor.CreateTasks,
        StopTasks                   : taskExecutor.StopTasks
    }

}

module.exports = StandardTaskExecutorMachineService