const EventEmitter = require('events')
const CreateCommunicationInterface = require("../Utils/CreateCommunicationInterface")
const StartMainApplication = require("../Utils/StartMainApplication")
const FormatterDataLog = require("../Utils/FormatterDataLog")

const DaemonLaunchCommand = async () => {

	process.env.DAEMON_SOCKET_PATH = "/home/kaiocezar/Workspaces/meta-platform-repo/EcosystemData/sockets/instance-manager.sock"

	const loggerEmitter = new EventEmitter()
	loggerEmitter.on("log", async (dataLog) => console.log(await FormatterDataLog(dataLog)))
	try {
		const rpcClient = await CreateCommunicationInterface()
		const executionStatus = await rpcClient.GetStatus()

		if(executionStatus === "STARTING") {
			await StartMainApplication(loggerEmitter)
		} else {
			loggerEmitter 
            && loggerEmitter.emit("log", {
				sourceName: "execution-supervisor", 
				type:"warning", 
				message: "A aplicação principal já esta em atividade!"
				
			})
		loggerEmitter 
            && loggerEmitter.emit("log", {
				sourceName: "execution-supervisor", 
				type:"warning", 
				message: `Main application state is [${executionStatus}]`
			})
		}
		
		
	} catch (e) {
		if(e.code === 14){
			await StartMainApplication(loggerEmitter)
		} else {
			loggerEmitter 
            && loggerEmitter.emit("log", {sourceName: "execution-supervisor", type:"warning", message: e})
		}
	}
}

module.exports = DaemonLaunchCommand