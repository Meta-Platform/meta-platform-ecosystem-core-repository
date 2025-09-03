const { resolve } = require("path")

const EXT_TYPE = "cli"

const CreateBasePackage = require("./Helpers/CreateBasePackage")

const CreateCommandsStruct = require("./Helpers/CreateCommandsStruct")

const CreateCliPackage = async ({
    packageName,
    workingDirPath,
    executablesDefinition,
    author,
    PKG_CONF_DIRNAME_METADATA
}) => {

    const namespace = `${packageName}.${EXT_TYPE}`
    const basePath = resolve(workingDirPath, namespace)

    const {
        srcPath,
        metadataDirPath
    } = await CreateBasePackage({
        basePath,
        namespace,
        author,
        PKG_CONF_DIRNAME_METADATA
    })


    //executablesDefinition
    await CreateCommandsStruct({
        srcPath,
        metadataDirPath,
        executablesDefinition
    })

    return basePath
	
}

module.exports = CreateCliPackage