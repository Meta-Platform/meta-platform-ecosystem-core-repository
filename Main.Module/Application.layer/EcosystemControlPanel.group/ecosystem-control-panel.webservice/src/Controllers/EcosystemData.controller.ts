const EcosystemDataController = (params: any) => {

    const { 
        ecosystemdataHandlerService
    } = params

    return {
        controllerName : "EcosystemDataController",
        GetEcosystemDataPath: ecosystemdataHandlerService.GetEcosystemDataPath,
        SetEcosystemDataPath: (path: any) => ecosystemdataHandlerService.SetEcosystemDataPath(path)
    }
}

module.exports = EcosystemDataController