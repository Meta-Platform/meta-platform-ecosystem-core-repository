const { join } = require('path') as typeof import('path')

const FilterAppplicationTasks = (tasks: any[]) =>
    tasks.filter(({objectLoaderType}: any) => objectLoaderType ==='application-instance')

const ExecutionDataState = require("../Helpers/ExecutionDataState") as () => any
const ExecutionStatusTypes = require("../Helpers/ExecutionStatusTypes") as Record<string, string>
const GetIsolateExecutionParameters = require("../Helpers/GetIsolateExecutionParameters") as (executionParams: any[], executionData: any) => any[]

const EnvironmentRuntimeService = (params: any) => {

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
            .AddTaskStatusListener(({taskId, status, statusReason}: any) =>
                executionState.NotifyTaskStatusChange(taskId, status, statusReason))

        onReady()
    }

    const Execute = async (environmentPath: string, executionParams: any[]) => {
        const taskIdList = taskExecutorMachineService
            .CreateTasks(executionParams)
        await WriteObjectToFile(join(environmentPath, "execution-params.json"), executionParams)
        const executionId = executionState.RegisterExecution(environmentPath, taskIdList)
        return executionId
    }

    const ExecuteEnvironment = async (environmentPath: string) => {
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

    const StopExecution = (executionId: string | number) => {
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
    const StopPackage = (packagePath: string) => {
        // Todas as application-tasks com esse rootPath (pode haver tasks antigas
        // já TERMINATED acumuladas no task-executor além da ativa).
        const matchingTaskIds = new Set(
            ListApplicationTask()
                .filter((task: any) => task.staticParameters && task.staticParameters.rootPath === packagePath)
                .map((task: any) => String(task.taskId)))

        if(matchingTaskIds.size === 0)
            return { stopped: false, reason: "pacote não está em execução" }

        // Encontra a execução ATIVA que contém alguma dessas tasks.
        const execution = executionState.ListExecutions()
            .find((record: any) => record
                && record.status !== ExecutionStatusTypes.TERMINATED
                && record.statusAssociatedTasks
                && Object.keys(record.statusAssociatedTasks).some((taskId: string) => matchingTaskIds.has(String(taskId))))

        if(!execution)
            return { stopped: false, reason: "execução ativa não encontrada" }

        StopExecution(execution.executionId)
        return { stopped: true, executionId: execution.executionId }
    }

    const ListApplicationTask = () => 
        FilterAppplicationTasks(taskExecutorMachineService.ListTasks())

    const _GetMetadataHierarchy = async (environmentPath: string) => {
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