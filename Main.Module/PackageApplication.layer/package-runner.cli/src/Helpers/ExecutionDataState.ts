const EventEmitter = require('node:events')
const ExecutionStatusTypes = require("./ExecutionStatusTypes")
const TaskStatusTypes = require("./TaskStatusTypes")

const EXECUTION_STATUS_CHANGE = Symbol()

const CheckIfExecutionCanBeActivated = (statusAssociatedTasks: any) => {
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

const CheckIfExecutionCanBeTerminated = (statusAssociatedTasks: any) => {
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

    const executionRecords: any[] = []
    const eventEmitter  = new EventEmitter()

    const _CreateEmptyRecord = () => executionRecords.push({}) - 1

    const _CompleteRegistration = (executionId: any, { environmentPath, associatedTaskIds }: any) => 
        executionRecords[executionId] = {
            executionId,
            status: ExecutionStatusTypes.STARTING,
            environmentPath,
            statusAssociatedTasks: associatedTaskIds.reduce((acc: any, taskId: any) => ({...acc, [taskId]: undefined}), {})
        }

    const RegisterExecution = (environmentPath: any, associatedTaskIds: any) => {
        const executionId = _CreateEmptyRecord()
        _CompleteRegistration(executionId, { environmentPath, associatedTaskIds })
        return executionId
    }

    const CheckIfExecutionCanBeRegistered = (environmentPath: any) => 
        executionRecords
            .filter((execution) => execution.environmentPath === environmentPath && execution.status !== ExecutionStatusTypes.TERMINATED)
            .length > 0

    const GetExecutionData = (executionId: any) => executionRecords[parseInt(executionId)]

    const GetActiveExecutions = () => executionRecords
        .filter(executionRecord => executionRecord.status !== ExecutionStatusTypes.TERMINATED)

    const ForEachActiveExecution = (f: any) => 
        GetActiveExecutions()
        .forEach(f)

    const UpdateTaskStatus = (taskId: any, status: any) => {
        ForEachActiveExecution((execution: any) => {
            const { statusAssociatedTasks } = execution
            if(statusAssociatedTasks.hasOwnProperty(taskId)){
                statusAssociatedTasks[taskId] = status
            }
        })
        _RefreshAllExecutionStatus(status)
    }

    const _ChangeExecutionStatus = (execution: any, nextStatus: any) => {
        const { executionId } = execution
        execution.status = nextStatus
        eventEmitter.emit(EXECUTION_STATUS_CHANGE, {executionId, status: nextStatus})
    }

    const _RefreshAllExecutionStatus = (statusSource: any) => {
        
        ForEachActiveExecution((execution: any) => {
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

    const NotifyTaskStatusChange = (taskId: any, status: any) => {
        if(status === TaskStatusTypes.ACTIVE
            || status === TaskStatusTypes.FINISHED
            || status === TaskStatusTypes.FAILURE
            || status === TaskStatusTypes.TERMINATED){
                UpdateTaskStatus(taskId, status)
        }
    }

    const GetAssociatedTaskIds = (executionId: any) => {
        const { statusAssociatedTasks } = GetExecutionData(executionId)
        return Object.keys(statusAssociatedTasks).map((taskId) => parseInt(taskId))
    }

    const AddExecutionStatusListener = (executionId: any, f: any) => 
        eventEmitter.on(EXECUTION_STATUS_CHANGE, (eventData: any) => {
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