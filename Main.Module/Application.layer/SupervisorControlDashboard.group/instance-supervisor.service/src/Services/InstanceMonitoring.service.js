const EventEmitter = require('node:events')
const { resolve } = require("path")

const AreArraysEqual = require("../Utils/AreArraysEqual")

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()    

const InstanceMonitoringService = (params) => {

    const {
        installDataDirPath,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        supervisorLib,
        onReady 
    } = params

    const WatchSocketDirectory = supervisorLib.require("WatchSocketDirectory")
    const ListSocketFilesName = supervisorLib.require("ListSocketFilesName")
    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const ecosystemDefaultFilePath = resolve(installDataDirPath, ecosystemDefaultsFileRelativePath)
    let supervisorSocketsDirPath = undefined

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

        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        supervisorSocketsDirPath = resolve(installDataDirPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)

        socketFileNameList = await ListSocketFilesName(supervisorSocketsDirPath)
        _StartSocketsDirectoryWatcher()
        onReady()

    }
    const _NotifySocketFileListChange = () => 
            eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    
    const AddChangeSocketListListener = (f) =>
		eventEmitter
			.on(SOCKET_FILE_LIST_CHANGE_EVENT, (socketFileNameList) => f(socketFileNameList))
    
    const monitoringObject = {
        AddChangeSocketListListener,
        GetSocketFileNameList: () => socketFileNameList
    }
        
    _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringService