const StandardTaskExecutorMachineService = (params) => {

    const {
        installDataDirPath,
        taskExecutorLib,
        utilitiesLib,
        onReady
    } = params

    // Descoberta dinâmica: monta o mapa de object loaders a partir dos
    // taskloaders.json dos repositórios instalados. O taskloader-registry.lib é
    // carregado por require() direto (a partir do installationPath do EssentialRepo)
    // — NÃO via handler de pacote (o handler.require faz require.main.require +
    // manipula NODE_PATH, o que desalinha o carregamento e quebra a montagem de params).
    const _absInstallDataDirPath = installDataDirPath.replace("~", require("os").homedir())
    const _repositoriesData = JSON.parse(require("fs").readFileSync(
        require("path").join(_absInstallDataDirPath, "repositories.json"), { encoding: "utf8" }))
    const _CreateTaskLoaders = require(require("path").join(
        _repositoriesData.EssentialRepo.installationPath,
        "Taskloaders.Module/Registry.layer/taskloader-registry.lib/src/CreateTaskLoaders"))
    const taskLoaders = _CreateTaskLoaders({ repositoriesData: _repositoriesData })

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