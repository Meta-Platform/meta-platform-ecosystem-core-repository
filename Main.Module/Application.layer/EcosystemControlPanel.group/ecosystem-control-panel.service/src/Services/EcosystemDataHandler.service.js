const EcosystemDataHandlerService = (params) => {

    const {
        installDataDirPath,
        onReady 
    } = params

    const _Start = () => onReady()

    _Start()

    return {
        GetEcosystemDataPath: () => installDataDirPath
    }

}

module.exports = EcosystemDataHandlerService