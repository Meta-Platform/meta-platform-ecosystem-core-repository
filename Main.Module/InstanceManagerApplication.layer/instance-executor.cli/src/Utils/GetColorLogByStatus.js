
const GetColorLogByStatus = (status) => {
    switch(status){
        case "AWAITING_PRECONDITIONS":
            return "gray"
        case "PRECONDITIONS_COMPLETED":
        case "PREPPED_TO_START":
            return "blue"
        case "STARTING":
            return "yellow"
        case "STOPPING":
            return "bgYellow"
        case "ACTIVE":
            return "bgGreen"
        case "FINISHED":
            return "green"
        case "FAILURE":
            return "bgRed"
        case "TERMINATED":
            return "red"
    }
}

module.exports = GetColorLogByStatus