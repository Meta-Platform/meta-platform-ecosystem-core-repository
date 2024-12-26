const EventEmitter = require('node:events')
const { resolve } = require("path")

const AreArraysEqual = require("../Utils/AreArraysEqual")

const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()

const CreateInstanceSocketHandlerManager = require("../Helpers/CreateInstanceSocketHandlerManager")

const InstanceMonitoringManager = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        supervisorLib,
        onReady 
    } = params

    const WatchSocketDirectory = supervisorLib.require("WatchSocketDirectory")
    const ListSocketFilesName  = supervisorLib.require("ListSocketFilesName")
    const ReadJsonFile         = jsonFileUtilitiesLib.require("ReadJsonFile")

    const ecosystemDefaultFilePath = resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
    let supervisorSocketsDirPath = undefined

    const eventEmitter = new EventEmitter()

    const {
        MonitoringOverview,
        TryStartSocketMonitoring,
        StartSocketMonitoring,
        GetMonitoredSocketFilePaths
    } = CreateInstanceSocketHandlerManager()

    const _StartSocketsDirectoryWatcher = () => {
        WatchSocketDirectory({
            directoryPath: supervisorSocketsDirPath, onChangeSocketFileList: (newSocketFileNameList) => {
                if(!AreArraysEqual(newSocketFileNameList, socketFileNameList)){
                    newSocketFileNameList
                    .forEach((socketFileName) => TryStartSocketMonitoring(socketFileName))
                    _NotifySocketFileListChange()
                }
            }})
    }

    const _Start = async () => {

        const socketsDirPath = await _ConfigSocketsDirPath()

        const socketFileNames = await ListSocketFilesName(socketsDirPath)
        
        socketFileNames
            .forEach((socketFileName) => StartSocketMonitoring(socketFileName))

        _StartSocketsDirectoryWatcher()
        onReady()

    }

    const _ConfigSocketsDirPath = async () => {
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        const socketsDirPath = resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)
        supervisorSocketsDirPath = socketsDirPath
        return socketsDirPath
    }

    const _NotifySocketFileListChange = () => 
            eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, GetMonitoredSocketFilePaths())
    
    const AddChangeSocketListListener = (f) =>
		eventEmitter
			.on(SOCKET_FILE_LIST_CHANGE_EVENT, (socketFileNames) => f(socketFileNames))
    
    const monitoringObject = {
        AddChangeSocketListListener,
        GetMonitoredSocketFilePaths,
        GetOverview: MonitoringOverview
    }
        
    _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringManager