const SmartRequire = require("./SmartRequire")
const MountAPIs = require("../../mount-api.lib/src/MountAPIs")
const colors = SmartRequire("colors")

const GetColorLogByType = (type) => {
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
}) => {

    try{
        const APIs = await MountAPIs({
            serverResourceEndpointPath,
            mainApplicationSocketPath
        })
        Log.message("CommandExecutor", "Conectado ao "+mainApplicationSocketPath)
        return await CommandFunction({APIs})
    } catch(e){
   
        if(e.erroredSysCall === "connect"){
            Log.error("CommandExecutor", "Não foi possivel se conectar com Ecosystem Daemon")
        } else throw e
    }
}

module.exports = CommandExecutor