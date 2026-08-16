import type { ExecutableDefinition } from "./Types"

const { resolve } = require("path") as typeof import("path")

const EXT_TYPE = "cli"

const CreateBasePackage = require("./Helpers/CreateBasePackage") as (options: any) => Promise<{ srcPath: string, metadataDirPath: string }>

const CreateCommandsStruct = require("./Helpers/CreateCommandsStruct") as (options: any) => Promise<void>

const CreateCliPackage = async ({
    packageName,
    workingDirPath,
    executablesDefinition,
    author,
    PKG_CONF_DIRNAME_METADATA
}: {
    packageName: string
    workingDirPath: string
    executablesDefinition: ExecutableDefinition[]
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


    //executablesDefinition
    await CreateCommandsStruct({
        srcPath,
        metadataDirPath,
        executablesDefinition
    })

    return basePath
	
}

module.exports = CreateCliPackage