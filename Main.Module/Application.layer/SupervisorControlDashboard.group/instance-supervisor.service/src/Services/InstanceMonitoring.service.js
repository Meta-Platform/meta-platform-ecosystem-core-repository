const EventEmitter = require('node:events')

const AreArraysEqual = require("../Utils/AreArraysEqual")

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()    

const InstanceMonitoringService = (params) => {

    const {
        supervisorSocketsDirPath,
        supervisorLib,
        onReady 
    } = params

    
    const WatchSocketDirectory = supervisorLib.require("WatchSocketDirectory")
    
    const eventEmitter = new EventEmitter()

    let socketFileNameList = []

    const _StartSocketsDirectoryWatcher = () => {
        WatchSocketDirectory({
            directoryPath: supervisorSocketsDirPath, onChangeSocketFileList: (newSocketFileNameList) => {
                if(!AreArraysEqual(newSocketFileNameList, socketFileNameList)){
                    socketFileNameList = newSocketFileNameList
                    _NotifySocketFileListChange()
                }
            }})
    }

    const _Start = async () => {
        _StartSocketsDirectoryWatcher()
        onReady()
    }
    const _NotifySocketFileListChange = () => 
            eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    
    const AddChangeSocketListListener = (f) =>
		eventEmitter
			.on(SOCKET_FILE_LIST_CHANGE_EVENT, (socketFileNameList) => f(socketFileNameList))
    
    const monitoringObject = {
        AddChangeSocketListListener
    }
        
    _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringService