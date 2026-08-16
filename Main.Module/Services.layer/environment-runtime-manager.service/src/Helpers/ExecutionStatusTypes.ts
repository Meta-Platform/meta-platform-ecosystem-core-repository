const ExecutionStatusTypes = Object.freeze({
    STARTING: "STARTING",
    RUNNING: "RUNNING",
    STOPPING: "STOPPING",
    TERMINATED: "TERMINATED",
    // ERROR faltava aqui: _RefreshAllExecutionStatus referenciava
    // ExecutionStatusTypes.ERROR (que resolvia para undefined) ao traduzir um
    // FAILURE de tarefa — a execução ficava com status undefined em vez de ERROR.
    ERROR: "ERROR"
})

module.exports = ExecutionStatusTypes