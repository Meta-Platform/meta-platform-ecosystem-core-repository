const path = require("path")

const EnvironmentsController = (params) => {

    const {
        ecosystemdataHandlerService,
        environmentHandlerService,
        jsonFileUtilitiesLib,
        ecosystemDefaultsFileRelativePath
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const GetMetadataHierarchy = async (environmentName) => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)

        const enviromentPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_EXECUTION_DATA_DIR, environmentName)

        const metadataHierarchyFilePath = path.resolve(enviromentPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA)
        const metadataHierarchy = await ReadJsonFile(metadataHierarchyFilePath)
        return metadataHierarchy
    }

    return {
        controllerName : "EnvironmentsController",
        ListEnvironments: environmentHandlerService.ListEnvironments,
        GetMetadataHierarchy
    }
}

module.exports = EnvironmentsController