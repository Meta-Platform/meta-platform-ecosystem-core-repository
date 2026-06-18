const EventEmitter = require('node:events')
const ExecutionStatusTypes = require("./ExecutionStatusTypes")
const TaskStatusTypes = require("./TaskStatusTypes")

const EXECUTION_STATUS_CHANGE = Symbol()

const CheckIfExecutionCanBeActivated = (statusAssociatedTasks) => {
    return Object
        .values(statusAssociatedTasks)
        .reduce((acc, status) => {
            if(acc){
                if((status === TaskStatusTypes.ACTIVE
                    || status === TaskStatusTypes.FINISHED)){
                        return true
                } else {
                    return false
                }
            }

            return acc
        }, true)
}

const CheckIfExecutionCanBeTerminated = (statusAssociatedTasks) => {
    return Object
    .values(statusAssociatedTasks)
    .reduce((acc, status) => {
        if(acc){
            if((status === TaskStatusTypes.TERMINATED)){
                    return true
            } else {
                return false
            }
        }

        return acc
    }, true)
}

const ExecutionDataState = () => {

    const executionRecords = []
    const eventEmitter  = new EventEmitter()

    const _CreateEmptyRecord = () => executionRecords.push({}) - 1

    const _CompleteRegistration = (executionId, { environmentPath, associatedTaskIds }) => 
        executionRecords[executionId] = {
            executionId,
            status: ExecutionStatusTypes.STARTING,
            environmentPath,
            statusAssociatedTasks: associatedTaskIds.reduce((acc, taskId) => ({...acc, [taskId]: undefined}), {})
        }

    const RegisterExecution = (environmentPath, associatedTaskIds) => {
        const executionId = _CreateEmptyRecord()
        _CompleteRegistration(executionId, { environmentPath, associatedTaskIds })
        return executionId
    }

    const CheckIfExecutionCanBeRegistered = (environmentPath) => 
        executionRecords
            .filter((execution) => execution.environmentPath === environmentPath && execution.status !== ExecutionStatusTypes.TERMINATED)
            .length > 0

    const GetExecutionData = (executionId) => executionRecords[parseInt(executionId)]

    const GetActiveExecutions = () => executionRecords
        .filter(executionRecord => executionRecord.status !== ExecutionStatusTypes.TERMINATED)

    const ForEachActiveExecution = (f) => 
        GetActiveExecutions()
        .forEach(f)

    const UpdateTaskStatus = (taskId, status) => {
        ForEachActiveExecution((execution) => {
            const { statusAssociatedTasks } = execution
            if(statusAssociatedTasks.hasOwnProperty(taskId)){
                statusAssociatedTasks[taskId] = status
            }
        })
        _RefreshAllExecutionStatus(status)
    }

    const _ChangeExecutionStatus = (execution, nextStatus) => {
        const { executionId } = execution
        execution.status = nextStatus
        eventEmitter.emit(EXECUTION_STATUS_CHANGE, {executionId, status: nextStatus})
    }

    const _RefreshAllExecutionStatus = (statusSource) => {
        
        ForEachActiveExecution((execution) => {
            const { statusAssociatedTasks } = execution
            switch(statusSource){
                case TaskStatusTypes.ACTIVE:
                case TaskStatusTypes.FINISHED:
                    if(CheckIfExecutionCanBeActivated(statusAssociatedTasks))
                        _ChangeExecutionStatus(execution, ExecutionStatusTypes.RUNNING)
                    break
                case ExecutionStatusTypes.TERMINATED:
                    if(CheckIfExecutionCanBeTerminated(statusAssociatedTasks))
                        _ChangeExecutionStatus(execution, ExecutionStatusTypes.TERMINATED)
                    else
                        _ChangeExecutionStatus(execution, ExecutionStatusTypes.STOPPING)
                    break
                case TaskStatusTypes.FAILURE:
                    _ChangeExecutionStatus(execution, ExecutionStatusTypes.ERROR)
                    break
            }
        })
    }

    const NotifyTaskStatusChange = (taskId, status) => {
        if(status === TaskStatusTypes.ACTIVE
            || status === TaskStatusTypes.FINISHED
            || status === TaskStatusTypes.FAILURE
            || status === TaskStatusTypes.TERMINATED){
                UpdateTaskStatus(taskId, status)
        }
    }

    const GetAssociatedTaskIds = (executionId) => {
        const { statusAssociatedTasks } = GetExecutionData(executionId)
        return Object.keys(statusAssociatedTasks).map((taskId) => parseInt(taskId))
    }

    const AddExecutionStatusListener = (executionId, f) => 
        eventEmitter.on(EXECUTION_STATUS_CHANGE, (eventData) => {
            if(eventData.executionId === parseInt(executionId)){
                f(eventData.status)
            }
        })
    
    return {
        RegisterExecution,
        GetExecutionData,
        CheckIfExecutionCanBeRegistered,
        NotifyTaskStatusChange,
        ListExecutions: () => executionRecords,
        AddExecutionStatusListener,
        GetAssociatedTaskIds
    }

}

module.exports = ExecutionDataState