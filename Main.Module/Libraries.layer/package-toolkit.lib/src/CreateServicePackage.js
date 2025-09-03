
const { resolve } = require("path")

const EXT_TYPE = "service"

const CreateBasePackage = require("./Helpers/CreateBasePackage")

const CreateServicePackage = async ({
    packageName,
    workingDirPath,
    author,
    PKG_CONF_DIRNAME_METADATA
}) => {
    const namespace = `${packageName}.${EXT_TYPE}`
    const basePath = resolve(workingDirPath, namespace)

    await CreateBasePackage({
        basePath,
        namespace,
        author,
        PKG_CONF_DIRNAME_METADATA
    })

    return basePath
    
}
module.exports = CreateServicePackage