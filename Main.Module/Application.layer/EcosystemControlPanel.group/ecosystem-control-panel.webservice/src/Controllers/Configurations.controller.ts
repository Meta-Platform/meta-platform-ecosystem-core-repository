const path = require("path")
const { readdir } = require("node:fs/promises")

const ConfigurationsController = (params: any) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")

    const _GetEcosystemDefaults = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    const _GetConfigFilesDirPath = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_CONFIGURATIONS_DIR)
    }

    const GetDefaultEcosystemParameters = async () => _GetEcosystemDefaults()

    const ListConfigFiles = async () => {
        const configFilesDirPath = await _GetConfigFilesDirPath()
        const entries = await readdir(configFilesDirPath, { withFileTypes: true })
        return entries
            .filter((entry: any) => !entry.isDirectory())
            .map((entry: any) => entry.name)
    }

    const GetConfigFile = async (configFileName: any) => {
        const configFilesDirPath = await _GetConfigFilesDirPath()
        const configFilePath = path.resolve(configFilesDirPath, configFileName)
        const content = await ReadJsonFile(configFilePath)
        return {
            configFileName,
            content
        }
    }

    // Escrita de arquivo de configuração. A confirmação do usuário é feita na
    // UI (pode impactar/quebrar o ecossistema); aqui apenas persiste o conteúdo.
    const SaveConfigFile = async ({ configFileName, content }: any) => {
        const configFilesDirPath = await _GetConfigFilesDirPath()
        const configFilePath = path.resolve(configFilesDirPath, configFileName)
        await WriteObjectToFile(configFilePath, content)
        return {
            configFileName,
            content
        }
    }

    return {
        controllerName : "ConfigurationsController",
        GetDefaultEcosystemParameters,
        ListConfigFiles,
        GetConfigFile,
        SaveConfigFile
    }
}

module.exports = ConfigurationsController
