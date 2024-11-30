const EventEmitter = require('node:events')

const UPDATE_CHECK_INTERVAL_TIMESTAMP = 2000
    
const SOCKET_FILE_LIST_CHANGE_EVENT = Symbol()    

const CopyArray = (array) => [...array]

const AreArraysEqual = (array1, array2) => {

    if (array1.length !== array2.length) 
        return false

    const sortedArray1 = CopyArray(array1).sort()
    const sortedArray2 = CopyArray(array2).sort()

    for (let i = 0; i < sortedArray1.length; i++) 
        if (sortedArray1[i] !== sortedArray2[i]) 
            return false
        
    return true

}

const InstanceMonitoringService = async (params) => {

    const {
        supervisorSocketsDirPath,
        supervisorLib,
        onReady 
    } = params

    const ListSocketFilesName = supervisorLib.require("ListSocketFilesName")

    const eventEmitter = new EventEmitter()

    let socketFileNameList = []
    let intervalId = null

    const _StartCheckUpdate = () => {
        if (!intervalId) {
            intervalId = setInterval(_UpdateSocketFileListName, UPDATE_CHECK_INTERVAL_TIMESTAMP)
        }
    }

    const _StopCheckUpdate = () => {
        if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
        }
    }

    const _UpdateSocketFileListName = async () => {
        const newSocketFileNameList = await ListSocketFilesName(supervisorSocketsDirPath)

        if(!AreArraysEqual(newSocketFileNameList, socketFileNameList)){
            socketFileNameList = newSocketFileNameList
            _NotifySocketFileListChange()
        }
    }

    const _Start = async () => {
        await _UpdateSocketFileListName()
        onReady()
        _StartCheckUpdate()
    }
    const _NotifySocketFileListChange = () => 
            eventEmitter.emit(SOCKET_FILE_LIST_CHANGE_EVENT, socketFileNameList)
    
    const AddChangeSocketListListener = (f) =>
		eventEmitter
			.on(SOCKET_FILE_LIST_CHANGE_EVENT, (v) => f(v))
    
    const monitoringObject = {
        AddChangeSocketListListener
    }
    
    const finalizationRegistry = 
    new FinalizationRegistry(() => _StopCheckUpdate())

    finalizationRegistry.register(monitoringObject, null)
        
    await _Start()
        
    return monitoringObject

}

module.exports = InstanceMonitoringService