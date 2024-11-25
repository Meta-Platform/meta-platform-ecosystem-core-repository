const SupervisorController = (params) => {

    const {
        supervisorSocketsDirPath,
        supervisorLib
    } = params

    const ListSockets = async () => {
        const ListSocketFilesName = supervisorLib.require("ListSocketFilesName")
        const socketFileNameList = await ListSocketFilesName(supervisorSocketsDirPath)
        return socketFileNameList
    }

    const controllerServiceObject = {
        controllerName : "SupervisorController",
        ListSockets,
        ShowInstanceStatus: (socketFilename) => {},
        ListInstanceTasks: (socketFilename) => {},
        KillInstance: (socketFilename) => {},
        ShowInstanceTaskInformation: ({socketFilename, taskId}) => {}
    }

    return Object.freeze(controllerServiceObject)
    
}


module.exports = SupervisorController