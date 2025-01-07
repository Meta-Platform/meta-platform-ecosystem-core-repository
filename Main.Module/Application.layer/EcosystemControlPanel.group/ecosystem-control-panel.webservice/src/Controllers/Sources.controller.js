const path = require("path")
const EventEmitter = require('node:events')

const ExtractSourceListBySourcesData = (sourcesData) => {

    const repositoryNamespaceList = Object.keys(sourcesData)
    const sourceList = repositoryNamespaceList
    .reduce((acc, repositoryNamespace) => {
        return [
            ...acc,
            ...sourcesData[repositoryNamespace]
                .map((sourceData) => ({
                    repositoryNamespace,
                    ...sourceData
                }))
        ]
    }, [])

    return sourceList
    
}

const ExtractActiveSourcesByRepoData = (repositoriesData) => {
    const installedRepositoriesList = Object.keys(repositoriesData)

    const installedApplicationsList = installedRepositoriesList
        .reduce((acc, repositoryNamespace) => {

            const { sourceData } = repositoriesData[repositoryNamespace]

            return [
                ...acc,
                {
                    repositoryNamespace,
                    sourceData
                }
            ]
        }, [])


    return installedApplicationsList
}

const SourcesController = (params) => {
 
    const { 
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        notificationHubService
    } = params

    const { NotifyEvent } = notificationHubService

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")
    const UpdateRepository = ecosystemInstallUtilitiesLib.require("UpdateRepository")

    const _GetEcosystemDefaults =  async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    const _ResolvePathWithEcosystemDataPath = async (paramName) => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults[paramName])
    }

    const _ReadConfigFile = async (paramName) => {
        const confFilePath = await _ResolvePathWithEcosystemDataPath(paramName)
        const configData = await ReadJsonFile(confFilePath)
        return configData
    }

    const _WriteConfigFile = async (paramName, configData) => {
        const confFilePath = await _ResolvePathWithEcosystemDataPath(paramName)
        await WriteObjectToFile(confFilePath, configData)
    }

    const ListSources = async () => {
        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const sourceList = ExtractSourceListBySourcesData(sourcesData)
        return sourceList
    }

    const ListActiveSources = async () => {
        const repositoriesData = await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA")
        const activeSourcesList = ExtractActiveSourcesByRepoData(repositoriesData)
        return activeSourcesList
    }

    const UpdateRepositoryByNamespace = async (repositoryNamespace) => {
        
        const repositoriesData = await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA")
        const {sourceData} = repositoriesData[repositoryNamespace]

        const ecosystemDefaults = await _GetEcosystemDefaults()

        const loggerEmitter = new EventEmitter()
        loggerEmitter
            .on("log", (dataLog) => NotifyEvent({
                origin: "SourcesController.UpdateRepositoryByNamespace",
                type:"log",
                content: dataLog
            }))

        await UpdateRepository({
            repositoryNamespace,
            sourceData,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults,
            loggerEmitter
        })
    }

    const CreateNewRepositoryNamespace = async (repositoryNamespace) => {

        const sourceData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")

        if(sourceData[repositoryNamespace] === undefined){

            const newSourceData = {
                ...sourceData,
                [repositoryNamespace]: []
            } 

            await _WriteConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA", newSourceData)
            
        } else {
            throw `O namespace ${repositoryNamespace} já esta cadastrado!`
        }
    }

    return {
        controllerName : "SourcesController",
        ListSources,
        ListActiveSources,
        UpdateRepository: UpdateRepositoryByNamespace,
        CreateNewRepositoryNamespace
    }
}

module.exports = SourcesController