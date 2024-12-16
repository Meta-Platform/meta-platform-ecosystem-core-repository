const path = require("path")

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
        jsonFileUtilitiesLib 
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const _GetSourcesData = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        const sourcesDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_SOURCE_DATA)
        const sourcesData = await ReadJsonFile(sourcesDataFilePath)
        return sourcesData
    }

    const _GetRepositoriesData = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
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

    return {
        controllerName : "SourcesController",
        ListSources,
        ListActiveSources
    }
}

module.exports = SourcesController