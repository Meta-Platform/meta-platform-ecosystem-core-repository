
const path = require("path")
const os = require('os')

const ConvertPathToAbsolutPath = (_path) => path
    .join(_path)
    .replace('~', os.homedir())


const EcosystemDataHandlerService = (params) => {

    const {
        installDataDirPath,
        onReady 
    } = params

    const _Start = () => onReady()

    _Start()

    return {
        GetEcosystemDataPath: () => ConvertPathToAbsolutPath(installDataDirPath)
    }

}

module.exports = EcosystemDataHandlerService