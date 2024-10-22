const { spawn } = require("child_process")

const CreateCommunicationInterface = require("./CreateCommunicationInterface")
const TryConnectLogStreaming = require("./TryConnectLogStreaming")

const MAX_CONNECT_RETRIES = 120
const RETRY_DELAY_MS = 1000

const StartMainApplication = (loggerEmitter) => {
    console.log("StartMainApplication ===========>")
    return new Promise(async (resolve, reject) => {

        try {

            loggerEmitter 
            && loggerEmitter.emit("log", {
                sourceName: "StartMainApplication", 
                type:"info", 
                message: "Iniciando o daemon"
            })

            const daemonSubProcess = spawn("start-instance-manager", {
                detached: true,
                stdio: 'ignore',
            })
            daemonSubProcess.unref()
            loggerEmitter 
                && loggerEmitter
                    .emit("log", {sourceName: "StartMainApplication", type:"info", message: `o processo PID[${daemonSubProcess.pid}] foi desvinculado do pai`})
            
            const daemonClient = await CreateCommunicationInterface()
            const logStreaming = await TryConnectLogStreaming({
                loggerEmitter,
                client: daemonClient,
                ms: RETRY_DELAY_MS,
                remainingConnectionAttempts: MAX_CONNECT_RETRIES,
            })
            const eventChangeListener = daemonClient.GetEventChangeListener()

            eventChangeListener.on('data', ({status}) => {
                if(status === "RUNNING"){
                    resolve()
                    logStreaming.cancel()
                    eventChangeListener.cancel()
                }
            })

            eventChangeListener.on("error", (error) => reject(error))
        } catch (e) {
            reject(e)
        }
    })
}

module.exports = StartMainApplication
