const { join } = require('path')

const FilterAppplicationTasks = (tasks) => 
    tasks.filter(({objectLoaderType}) => objectLoaderType ==='application-instance')

const ExecutionDataState = require("../Helpers/ExecutionDataState")
const ExecutionStatusTypes = require("../Helpers/ExecutionStatusTypes")
const GetIsolateExecutionParameters = require("../Helpers/GetIsolateExecutionParameters")

const EnvironmentRuntimeService = (params) => {

    const executionState = ExecutionDataState()

    const {
        executionParamsGeneratorLib,
        jsonFileUtilitiesLib,
        taskExecutorMachineService,
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA,
        onReady 
    } = params

    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")
    const ReadJsonFile      = jsonFileUtilitiesLib.require("ReadJsonFile")
    const TranslateMetadataHierarchyForExecutionParams = executionParamsGeneratorLib.require("TranslateMetadataHierarchyForExecutionParams")

    const Init = async () => {
        taskExecutorMachineService
            .AddTaskStatusListener(({taskId, status}) => 
                executionState.NotifyTaskStatusChange(taskId, status))

        onReady()
    }

    const Execute = async (environmentPath, executionParams) => {
        const taskIdList = taskExecutorMachineService
            .CreateTasks(executionParams)
        await WriteObjectToFile(join(environmentPath, "execution-params.json"), executionParams)
        const executionId = executionState.RegisterExecution(environmentPath, taskIdList)
        return executionId
    }

    const ExecuteEnvironment = async (environmentPath) => {
        if(!executionState.CheckIfExecutionCanBeRegistered(environmentPath)){
            const metadataHierarchy = await _GetMetadataHierarchy(environmentPath)
            const applicationExecutionParams = TranslateMetadataHierarchyForExecutionParams({
                metadataHierarchy, 
                environmentPath,
                EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES
            })
            const isolatedExecutionParameters = GetIsolateExecutionParameters(applicationExecutionParams, {environmentPath})
            const executionId = await Execute(environmentPath, isolatedExecutionParameters)
            return executionId
        }else {
            throw `O ambiente ${environmentPath} já esta em execução`
        }
    }

    const StopExecution = (executionId) => {
        const associatedTaskIds = executionState
            .GetAssociatedTaskIds(executionId)
        taskExecutorMachineService
            .StopTasks(associatedTaskIds)

        return {}
    }

    // Encerra a execução de um pacote a partir do seu caminho: localiza a
    // application-task cujo rootPath corresponde, descobre a execução ativa que
    // a contém e a encerra. Usado pelos painéis (my-desktop / eco-panel) que
    // conhecem o packagePath, não o executionId.
    const StopPackage = (packagePath) => {
        // Todas as application-tasks com esse rootPath (pode haver tasks antigas
        // já TERMINATED acumuladas no task-executor além da ativa).
        const matchingTaskIds = new Set(
            ListApplicationTask()
                .filter((task) => task.staticParameters && task.staticParameters.rootPath === packagePath)
                .map((task) => String(task.taskId)))

        if(matchingTaskIds.size === 0)
            return { stopped: false, reason: "pacote não está em execução" }

        // Encontra a execução ATIVA que contém alguma dessas tasks.
        const execution = executionState.ListExecutions()
            .find((record) => record
                && record.status !== ExecutionStatusTypes.TERMINATED
                && record.statusAssociatedTasks
                && Object.keys(record.statusAssociatedTasks).some((taskId) => matchingTaskIds.has(String(taskId))))

        if(!execution)
            return { stopped: false, reason: "execução ativa não encontrada" }

        StopExecution(execution.executionId)
        return { stopped: true, executionId: execution.executionId }
    }

    const ListApplicationTask = () => 
        FilterAppplicationTasks(taskExecutorMachineService.ListTasks())

    const _GetMetadataHierarchy = async (environmentPath) => {
        return await ReadJsonFile(join(environmentPath, ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA))
    }

    const ListRunningEnvironments = () => {
        return executionState.ListExecutions()
    }

    Init()

    return {
        ExecuteEnvironment,
        AddExecutionStatusListener: executionState.AddExecutionStatusListener,
        GetExecutionData: executionState.GetExecutionData,
        ListApplicationTask,
        ListRunningEnvironments,
        StopExecution,
        StopPackage
    }

}

module.exports = EnvironmentRuntimeService