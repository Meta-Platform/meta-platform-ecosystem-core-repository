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

    const ListSources = async () => {
        const sourcesData = await _GetSourcesData()
        const sourceList = ExtractSourceListBySourcesData(sourcesData)
        return sourceList
    }

    return {
        controllerName : "SourcesController",
        ListSources
    }
}

module.exports = SourcesController