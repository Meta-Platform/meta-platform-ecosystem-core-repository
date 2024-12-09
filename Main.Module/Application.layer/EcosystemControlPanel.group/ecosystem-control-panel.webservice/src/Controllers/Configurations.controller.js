const path = require("path")

const ConfigurationsController = (params) => {

    const { 
        installDataDirPath,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib 
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const GetDefaultEcosystemParameters = async () => {
        const ecosystemDefaultFilePath = path.resolve(installDataDirPath, ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    return {
        controllerName : "ConfigurationsController",
        GetDefaultEcosystemParameters
    }
}

module.exports = ConfigurationsController