const { readdir } = require('node:fs/promises')
const { resolve } = require("path")

const ListDirectories = async (path) => {
    const listItems = await readdir(path, { withFileTypes: true })
    const listDir =  listItems.filter((file) => file.isDirectory() )
    return listDir
}

const EnvironmentHandlerService = (params) => {

    const {
        installDataDirPath,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        onReady 
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const ecosystemDefaultFilePath = resolve(installDataDirPath, ecosystemDefaultsFileRelativePath)
    let executionDataaDirPath = undefined

    const _Start = async () => {

        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        executionDataaDirPath = resolve(installDataDirPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_EXECUTION_DATA_DIR)

        onReady()
        
    }

    _Start()

    return {
        ListEnvironments: async () => (await ListDirectories(executionDataaDirPath)).map(({name}) => name)
    }

}

module.exports = EnvironmentHandlerService