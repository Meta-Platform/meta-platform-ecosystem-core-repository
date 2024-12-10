const EcosystemDataController = (params) => {

    const { 
        ecosystemdataHandlerService
    } = params

    return {
        controllerName : "EcosystemDataController",
        GetEcosystemDataPath: ecosystemdataHandlerService.GetEcosystemDataPath
    }
}

module.exports = EcosystemDataController