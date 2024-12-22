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
    const UpdateRepository = ecosystemInstallUtilitiesLib.require("UpdateRepository")

    const _GetEcosystemDefaults =  async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    const _GetSourcesData = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const sourcesDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_SOURCE_DATA)
        const sourcesData = await ReadJsonFile(sourcesDataFilePath)
        return sourcesData
    }

    const _GetRepositoriesData = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const repoDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA)
        const repositoriesData = await ReadJsonFile(repoDataFilePath)
        return repositoriesData
    }

    const ListSources = async () => {
        const sourcesData = await _GetSourcesData()
        const sourceList = ExtractSourceListBySourcesData(sourcesData)
        return sourceList
    }

    const ListActiveSources = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const activeSourcesList = ExtractActiveSourcesByRepoData(repositoriesData)
        return activeSourcesList
    }

    const UpdateRepositoryByNamespace = async (repositoryNamespace) => {
        
        const repositoriesData = await _GetRepositoriesData()
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

    return {
        controllerName : "SourcesController",
        ListSources,
        ListActiveSources,
        UpdateRepository: UpdateRepositoryByNamespace
    }
}

module.exports = SourcesController