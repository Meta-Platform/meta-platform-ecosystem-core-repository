const { join } = require('path')

const FilterAppplicationTasks = (tasks) => 
    tasks.filter(({objectLoaderType}) => objectLoaderType ==='application-instance')

const ExecutionDataState = require("../Helpers/ExecutionDataState")
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
        StopExecution
    }

}

module.exports = EnvironmentRuntimeService