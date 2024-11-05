const Table = require("cli-table3")
const { basename } = require("path")
const colors = require("colors")

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

const MountTaskTable = async (taskList) => {

    const table = new Table({
        head: [
            'TID', 
            'PTID', 
            'Loader Type', 
            'Status', 
            'Namespace / Tag', 
            'Path / API & Controller',
            'Environment'
        ],
        colWidths: [5, 6, 14, 12, 30, 30, 30]
    })

    taskList.forEach(task => {
        const {
            taskId,
            pTaskId,
            objectLoaderType,
            status,
            staticParameters: {
                namespace,
                tag,
                path,
                type,
                url,
                apiTemplate,
                controller,
                serverEndpointStatus,
                serverName,
                rootPath,
                executionData: { environmentPath }
            }
        } = task
        table.push([
            taskId,
            pTaskId,
            objectLoaderType,
            colors[GetColorLogByStatus(status)](status),
            namespace || tag || url && (`${type} -> ${url}`),
            path && basename(path) || apiTemplate && `${apiTemplate}\n${controller}` || serverName && `${serverName}\n${serverEndpointStatus}` || rootPath,
            basename(environmentPath)
        ])
    })

    return table
}

const ListTasksCommand = async ({ startupParams, params }) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")
    
    const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .TaskExecutorMachine

        try{
            const taskList = await API.ListTasks()
            const table = await MountTaskTable(taskList)
            console.log(table.toString())
        } catch(e){
            console.log(e)
        }
    }

	await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ListTasksCommand