const path = require("path")

const SupervisorController = (params) => {

    const {
        supervisorSocketsDirPath,
        supervisorLib
    } = params

    const ListSocketFilesName = supervisorLib.require("ListSocketFilesName")
    const CreateCommunicationInterface = supervisorLib.require("CreateCommunicationInterface")

    const ListSockets = async () => {
        const socketFileNameList = await ListSocketFilesName(supervisorSocketsDirPath)
        return socketFileNameList
    }

    const ListInstanceTasks = async (socketFilename) => {

        const socketFilePath = path.resolve(supervisorSocketsDirPath, socketFilename)
        const daemonClient = await CreateCommunicationInterface(socketFilePath)
        const taskList = await daemonClient.ListTasks()
        return taskList
    }

    const controllerServiceObject = {
        controllerName : "SupervisorController",
        ListSockets,
        ShowInstanceStatus: (socketFilename) => {},
        ListInstanceTasks,
        KillInstance: (socketFilename) => {},
        ShowInstanceTaskInformation: ({socketFilename, taskId}) => {}
    }

    return Object.freeze(controllerServiceObject)
    
}


module.exports = SupervisorController