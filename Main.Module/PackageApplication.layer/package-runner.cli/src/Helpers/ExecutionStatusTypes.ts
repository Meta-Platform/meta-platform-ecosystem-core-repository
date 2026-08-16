const ExecutionStatusTypes = Object.freeze({
    STARTING: "STARTING",
    RUNNING: "RUNNING",
    STOPPING: "STOPPING",
    TERMINATED: "TERMINATED",
    // ERROR faltava: ExecutionDataState referenciava ExecutionStatusTypes.ERROR
    // (undefined) ao traduzir um FAILURE de tarefa.
    ERROR: "ERROR"
})

module.exports = ExecutionStatusTypes