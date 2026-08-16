import type { MountedAPIs } from "../../mount-api.lib/src/Types"

const SmartRequire = require("./SmartRequire") as (moduleName: string) => any
const MountAPIs = require("../../mount-api.lib/src/MountAPIs") as (options: {
    serverResourceEndpointPath: string
    mainApplicationSocketPath: string
}) => Promise<MountedAPIs | undefined>
const colors = SmartRequire("colors")

const GetColorLogByType = (type: string): string => {
    switch(type){
        case "success":
            return "bgGreen"
        case "info":
            return "bgBlue"
        case "warning":
            return "bgYellow"
        case "error":
            return "bgRed"
        default:
            return "bgGray"
    }
}

const CommandExecutor = async ({
    serverResourceEndpointPath,
    mainApplicationSocketPath,
    CommandFunction
}: {
    serverResourceEndpointPath: string
    mainApplicationSocketPath: string
    CommandFunction: (context: { APIs: MountedAPIs | undefined }) => any
}): Promise<any> => {

    try{
        const APIs = await MountAPIs({
            serverResourceEndpointPath,
            mainApplicationSocketPath
        })
        Log.message("CommandExecutor", "Conectado ao "+mainApplicationSocketPath)
        return await CommandFunction({APIs})
    } catch(e: any){

        if(e.erroredSysCall === "connect"){
            Log.error("CommandExecutor", "Não foi possivel se conectar com Ecosystem Daemon")
        } else throw e
    }
}

module.exports = CommandExecutor
