
import type { ServiceDefinition } from "./Types"

const { resolve } = require("path") as typeof import("path")

const EXT_TYPE = "service"

const CreateBasePackage = require("./Helpers/CreateBasePackage") as (options: any) => Promise<{ srcPath: string, metadataDirPath: string }>
const CreateServicesStruct = require("./Helpers/CreateServicesStruct") as (options: any) => Promise<void>

const CreateServicesPackage = async ({
    packageName,
    workingDirPath,
    servicesDefinition,
    author,
    PKG_CONF_DIRNAME_METADATA
}: {
    packageName: string
    workingDirPath: string
    servicesDefinition: ServiceDefinition[]
    author?: string
    PKG_CONF_DIRNAME_METADATA: string
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