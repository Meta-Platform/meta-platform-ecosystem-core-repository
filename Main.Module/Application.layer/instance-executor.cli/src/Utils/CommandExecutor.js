const EventEmitter = require('node:events')
const MountAPIs = require("./MountAPIs")
const colors = require("colors")


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
            return undefined
    }
}

const CommandExecutor = async ({
    serverResourceEndpointPath,
    mainApplicationSocketPath,
    CommandFunction
}) => {

    const loggerEmitter = new EventEmitter()

    loggerEmitter.on("log", (dataLog) => {
        const {
          sourceName,
          type,
          message
        } = dataLog

        const color = GetColorLogByType(type)

        const now = new Date()
        const offset = now.getTimezoneOffset() * 60000
        const localISOTime = (new Date(now - offset)).toISOString()

        const typeFormatted = type.padEnd(7)

        const formattedMessage = `${colors.dim(`[${localISOTime}]`)} ${colors.bgBlue("[adm-cli]")} ${colors[color](`[${typeFormatted}]`)} ${colors.inverse(`[${sourceName}]`)} ${message}`
        console.log(formattedMessage)
    })

    try{
        const APIs = await MountAPIs({
            serverResourceEndpointPath,
            mainApplicationSocketPath
        })
        loggerEmitter 
        && loggerEmitter.emit("log", {sourceName: "CommandExecutor", type:"success", message:"Conectado ao Ecosystem Daemon!"})
        await CommandFunction({APIs}, loggerEmitter)
    } catch(e){
   
        if(e.erroredSysCall === "connect"){
            loggerEmitter 
            && loggerEmitter.emit("log", {sourceName: "CommandExecutor", type:"error", message:"Não foi possivel se conectar com Ecosystem Daemon"})
        } else throw e
    }
}

module.exports = CommandExecutor