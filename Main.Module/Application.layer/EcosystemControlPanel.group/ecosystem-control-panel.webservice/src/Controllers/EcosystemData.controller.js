const EcosystemDataController = (params) => {

    const { 
        ecosystemdataHandlerService
    } = params

    return {
        controllerName : "EcosystemDataController",
        GetEcosystemDataPath: ecosystemdataHandlerService.GetEcosystemDataPath,
        SetEcosystemDataPath: (path) => ecosystemdataHandlerService.SetEcosystemDataPath(path)
    }
}

module.exports = EcosystemDataController