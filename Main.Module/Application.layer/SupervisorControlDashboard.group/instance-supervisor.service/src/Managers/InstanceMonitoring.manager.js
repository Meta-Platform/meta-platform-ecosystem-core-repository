const EventEmitter = require('node:events')
const { resolve } = require("path")

const AreArraysEqual = require("../Utils/AreArraysEqual")

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()    

const InstanceMonitoringManager = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        supervisorLib,
        onReady 
    } = params

    const WatchSocketDirectory = supervisorLib.require("WatchSocketDirectory")
    const ListSocketFilesName = supervisorLib.require("ListSocketFilesName")
    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const ecosystemDefaultFilePath = resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
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
        supervisorSocketsDirPath = resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)

        socketFileNameList = await ListSocketFilesName(supervisorSocketsDirPath)
        _StartSocketsDirectoryWatcher()
        onReady()

    }
    const _NotifySocketFileListChange = () => 
            eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    
    const AddChangeSocketListListener = (f) =>
		eventEmitter
			.on(SOCKET_FILE_LIST_CHANGE_EVENT, (socketFileNameList) => f(socketFileNameList))


    const GetOverview = () => {
        return socketFileNameList
        .reduce((acc, socketFileName) => {
            return {
                ...acc,
                [socketFileName]:{}
            }
        }, {})
    }
    
    const monitoringObject = {
        AddChangeSocketListListener,
        GetSocketFileNameList: () => socketFileNameList,
        GetOverview
    }
        
    _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringManager