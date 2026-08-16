const Table = require("cli-table3")
const { basename } = require("path")

const MountTaskTable = (list: any) => {

    const table = new Table({
        head: ["ID", "Status", "Environment Name"],
        colWidths: [5, 12, 60]
    })

    list.forEach((environmentData: any) => {
        table.push([
            environmentData.executionId,
            environmentData.status,
            basename(environmentData.environmentPath)
        ])
    })

    return table
}

const ListEnvironmentCommand = async ({ startupParams, params }: any) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")
    
    const CommandFunction = async ({ APIs }: any) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .EnvironmentRuntime
        try{
            const environmentsInExecution = await API.ListRunningEnvironments()
            const table = MountTaskTable(environmentsInExecution)
            Log.message("ListEnvironments", table.toString())
        } catch(e: any){
            Log.error("ListEnvironments", e)
        }
    }

	await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ListEnvironmentCommand