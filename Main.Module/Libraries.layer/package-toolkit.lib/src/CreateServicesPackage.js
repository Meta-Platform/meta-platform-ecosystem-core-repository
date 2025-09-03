
const { resolve } = require("path")

const EXT_TYPE = "service"

const CreateBasePackage = require("./Helpers/CreateBasePackage")
const CreateServicesStruct = require("./Helpers/CreateServicesStruct")

const CreateServicesPackage = async ({
    packageName,
    workingDirPath,
    servicesDefinition,
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

    await CreateServicesStruct({
        srcPath,
        metadataDirPath,
        servicesDefinition
    })

    return basePath
    
}
module.exports = CreateServicesPackage