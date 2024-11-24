const SupervisorController = (params) => {

    const controllerServiceObject = {
        controllerName : "SupervisorController",
        ListSockets: () => {},
        ShowInstanceStatus: (socketFilename) => {},
        ListInstanceTasks: (socketFilename) => {},
        KillInstance: (socketFilename) => {},
        ShowInstanceTaskInformation: ({socketFilename, taskId}) => {}
    }

    return Object.freeze(controllerServiceObject)
    
}


module.exports = SupervisorController