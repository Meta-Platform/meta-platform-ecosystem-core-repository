const EventEmitter = require('node:events') as typeof import('node:events')
const ExecutionStatusTypes = require("./ExecutionStatusTypes") as Record<string, string>
const TaskStatusTypes = require("./TaskStatusTypes") as Record<string, string>

/** O registro de UMA execução de ambiente, com o status das tarefas dela. */
type ExecutionRecord = {
    executionId: number
    status: string
    environmentPath: string
    statusAssociatedTasks: Record<string, string | undefined>
    /** Só preenchido em ERROR — ver _ChangeExecutionStatus. */
    statusReason?: string
}

const EXECUTION_STATUS_CHANGE = Symbol()

const CheckIfExecutionCanBeActivated = (statusAssociatedTasks: Record<string, string | undefined>): boolean => {
    return Object
        .values(statusAssociatedTasks)
        .reduce((acc: boolean, status) => {
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

const CheckIfExecutionCanBeTerminated = (statusAssociatedTasks: Record<string, string | undefined>): boolean => {
    return Object
    .values(statusAssociatedTasks)
    .reduce((acc: boolean, status) => {
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

    const executionRecords: ExecutionRecord[] = []
    const eventEmitter  = new EventEmitter()

    const _CreateEmptyRecord = () => executionRecords.push({} as ExecutionRecord) - 1

    const _CompleteRegistration = (executionId: number, { environmentPath, associatedTaskIds }: { environmentPath: string, associatedTaskIds: (string | number)[] }) =>
        executionRecords[executionId] = {
            executionId,
            status: ExecutionStatusTypes.STARTING,
            environmentPath,
            statusAssociatedTasks: associatedTaskIds.reduce((acc: Record<string, string | undefined>, taskId) => ({...acc, [taskId]: undefined}), {})
        }

    const RegisterExecution = (environmentPath: string, associatedTaskIds: (string | number)[]) => {
        const executionId = _CreateEmptyRecord()
        _CompleteRegistration(executionId, { environmentPath, associatedTaskIds })
        return executionId
    }

    const CheckIfExecutionCanBeRegistered = (environmentPath: string) => 
        executionRecords
            .filter((execution) => execution.environmentPath === environmentPath && execution.status !== ExecutionStatusTypes.TERMINATED)
            .length > 0

    const GetExecutionData = (executionId: string | number) => executionRecords[parseInt(String(executionId))]

    const GetActiveExecutions = () => executionRecords
        .filter(executionRecord => executionRecord.status !== ExecutionStatusTypes.TERMINATED)

    const ForEachActiveExecution = (f: (execution: ExecutionRecord) => void) => 
        GetActiveExecutions()
        .forEach(f)

    const UpdateTaskStatus = (taskId: string | number, status: string, statusReason?: string) => {
        ForEachActiveExecution((execution) => {
            const { statusAssociatedTasks } = execution
            if(statusAssociatedTasks.hasOwnProperty(taskId)){
                statusAssociatedTasks[taskId] = status
            }
        })
        _RefreshAllExecutionStatus(status, statusReason)
    }

    const _ChangeExecutionStatus = (execution: ExecutionRecord, nextStatus: string, statusReason?: string) => {
        const { executionId } = execution
        execution.status = nextStatus
        // Guardamos o motivo no registro para quem consultar GetExecutionData depois
        // do evento (o motivo só é relevante em ERROR; caso contrário fica undefined).
        execution.statusReason = statusReason
        eventEmitter.emit(EXECUTION_STATUS_CHANGE, {executionId, status: nextStatus, statusReason})
    }

    const _RefreshAllExecutionStatus = (statusSource: string, statusReason?: string) => {

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
                    _ChangeExecutionStatus(execution, ExecutionStatusTypes.ERROR, statusReason)
                    break
            }
        })
    }

    const NotifyTaskStatusChange = (taskId: string | number, status: string, statusReason?: string) => {
        if(status === TaskStatusTypes.ACTIVE
            || status === TaskStatusTypes.FINISHED
            || status === TaskStatusTypes.FAILURE
            || status === TaskStatusTypes.TERMINATED){
                UpdateTaskStatus(taskId, status, statusReason)
        }
    }

    const GetAssociatedTaskIds = (executionId: string | number) => {
        const { statusAssociatedTasks } = GetExecutionData(executionId)
        return Object.keys(statusAssociatedTasks).map((taskId) => parseInt(taskId))
    }

    const AddExecutionStatusListener = (executionId: string | number, f: (status: string, statusReason?: string) => void) =>
        eventEmitter.on(EXECUTION_STATUS_CHANGE, (eventData: any) => {
            if(eventData.executionId === parseInt(String(executionId))){
                f(eventData.status, eventData.statusReason)
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