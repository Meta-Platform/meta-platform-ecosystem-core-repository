const { resolve } = require("path")

const EXT_TYPE = "cli"

const CreateBasePackage = require("./Helpers/CreateBasePackage")

const CreateCliPackage = async ({
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
	
}
module.exports = CreateCliPackage