const TaskStatusTypes = Object.freeze({
    AWAITING_PRECONDITIONS  : "AWAITING_PRECONDITIONS",
    PRECONDITIONS_COMPLETED : "PRECONDITIONS_COMPLETED",
    PREPPED_TO_START        : "PREPPED_TO_START",
    STARTING                : "STARTING",
    STOPPING                : "STOPPING",
    ACTIVE                  : "ACTIVE",
    FINISHED                : "FINISHED",
    FAILURE                 : "FAILURE",
    TERMINATED              : "TERMINATED"
})

module.exports = TaskStatusTypes