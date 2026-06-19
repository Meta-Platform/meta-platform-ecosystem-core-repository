const path = require("path")

const EnvironmentsController = (params) => {

    const {
        ecosystemdataHandlerService,
        environmentHandlerService,
        jsonFileUtilitiesLib,
        ecosystemDefaultsFileRelativePath
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")

    const _GetEcosystemDefaults = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    const GetMetadataHierarchy = async (environmentName) => {

        const ecosystemDefaults = await _GetEcosystemDefaults()

        const enviromentPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_EXECUTION_DATA_DIR, environmentName)

        const metadataHierarchyFilePath = path.resolve(enviromentPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA)
        const metadataHierarchy = await ReadJsonFile(metadataHierarchyFilePath)
        return metadataHierarchy
    }

    const GetExecutionParams = async (environmentName) => {
        
        const ecosystemDefaults = await _GetEcosystemDefaults()

        const enviromentPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_EXECUTION_DATA_DIR, environmentName)

        const executionPlanFilePath = path.resolve(enviromentPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_FILENAME_EXECUTION_PLAN_DATA)
        const executionPlan = await ReadJsonFile(executionPlanFilePath)
        return executionPlan
    }

    // Altera os detalhes das tasks: sobrescreve o execution-params.json (o plano
    // de execução) do environment. A confirmação é feita na UI — afeta a próxima
    // execução deste environment (não a instância já em execução).
    const SaveExecutionParams = async ({ environmentName, executionParams }) => {

        const ecosystemDefaults = await _GetEcosystemDefaults()

        const enviromentPath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_EXECUTION_DATA_DIR, environmentName)
        const executionPlanFilePath = path.resolve(enviromentPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_FILENAME_EXECUTION_PLAN_DATA)

        await WriteObjectToFile(executionPlanFilePath, executionParams)
        return { environmentName, saved: true }
    }

    return {
        controllerName : "EnvironmentsController",
        ListEnvironments: environmentHandlerService.ListEnvironments,
        GetMetadataHierarchy,
        GetExecutionParams,
        SaveExecutionParams
    }
}

module.exports = EnvironmentsController