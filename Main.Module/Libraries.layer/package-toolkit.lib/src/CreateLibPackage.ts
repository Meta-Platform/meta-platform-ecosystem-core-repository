
const { resolve } = require("path") as typeof import("path")

const EXT_TYPE = "lib"

const CreateBasePackage = require("./Helpers/CreateBasePackage") as (options: any) => Promise<{ srcPath: string, metadataDirPath: string }>

const CreateLibPackage = async ({
    packageName,
    workingDirPath,
    author,
    PKG_CONF_DIRNAME_METADATA
}: {
    packageName: string
    workingDirPath: string
    author?: string
    PKG_CONF_DIRNAME_METADATA: string
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
module.exports = CreateLibPackage