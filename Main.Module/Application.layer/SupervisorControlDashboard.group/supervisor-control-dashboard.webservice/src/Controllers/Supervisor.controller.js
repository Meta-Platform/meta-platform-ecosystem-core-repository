const path = require("path")
const EventEmitter = require('node:events')

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()  

const SupervisorController = (params) => {

    const eventEmitter  = new EventEmitter()

    const {
        supervisorSocketsDirPath,
        instanceMonitoringService,
        supervisorLib
    } = params


    instanceMonitoringService.AddChangeSocketListListener((socketFileNameList) => {
        eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    })

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

    const ShowInstanceTaskInformation = async ({socketFilename, taskId}) => {
        const socketFilePath = path.resolve(supervisorSocketsDirPath, socketFilename)
        const daemonClient = await CreateCommunicationInterface(socketFilePath)
        const task = await daemonClient.GetTask(taskId)
        return task
    }

    const InstanceSocketFileListChange = (ws) => {
        eventEmitter
        .on(SOCKET_FILE_LIST_CHANGE_EVENT, (socketFileNameList) => {
            try{
                ws.send(JSON.stringify(socketFileNameList))
            }catch(e){
                console.log(e)
            }
        })
    }

    const controllerServiceObject = {
        controllerName : "SupervisorController",
        ListSockets,
        ShowInstanceStatus: (socketFilename) => {},
        ListInstanceTasks,
        KillInstance: (socketFilename) => {},
        ShowInstanceTaskInformation,
        InstanceSocketFileListChange
    }

    return Object.freeze(controllerServiceObject)
    
}


module.exports = SupervisorController