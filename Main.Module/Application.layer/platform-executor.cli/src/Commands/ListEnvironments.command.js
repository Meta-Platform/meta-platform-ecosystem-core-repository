const Table = require("cli-table3")
const { basename } = require("path")
const CommandExecutor = require("../Utils/CommandExecutor")

const MountTaskTable = (list) => {

    const table = new Table({
        head: ["ID", "Status", "Environment Name"],
        colWidths: [5, 12, 60]
    })

    list.forEach(environmentData => {
        table.push([
            environmentData.executionId,
            environmentData.status,
            basename(environmentData.environmentPath)
        ])
    })

    return table
}

const ListEnvironmentCommand = async ({startupParams}) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams
    
    const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .EnvironmentRuntime
        try{
            const environmentsInExecution = await API.ListRunningEnvironments()
            const table = MountTaskTable(environmentsInExecution)
            console.log(table.toString())
        } catch(e){
            console.log(e)
        }
    }

	await CommandExecutor({
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
}

module.exports = ListEnvironmentCommand