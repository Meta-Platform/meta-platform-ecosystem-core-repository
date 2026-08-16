import type { ExecutableDefinition } from "../Types"

const { resolve } = require("path") as typeof import("path")

const { 
    mkdir
} = require('node:fs/promises') as typeof import('node:fs/promises')

const CreateCliBootMetadataFile = require("./CreateCliBootMetadataFile") as (options: any) => Promise<void>
const CreateCommandGroupMetadataFile = require("./CreateCommandGroupMetadataFile") as (options: any) => Promise<void>
const CreateAllCommandSourceFiles = require("./CreateAllCommandSourceFiles") as (options: any) => Promise<void>

const CreateCommandsStruct = async ({
    srcPath,
    metadataDirPath,
    executablesDefinition
}: {
    srcPath: string
    metadataDirPath: string
    executablesDefinition: ExecutableDefinition[]
}) => {

    await CreateCliBootMetadataFile({
        metadataDirPath,
        executablesDefinition
    })

    await CreateCommandGroupMetadataFile({
        metadataDirPath,
        executablesDefinition
    })

    const commandsDirPath = resolve(srcPath, "Commands")
    await mkdir(commandsDirPath, { recursive: true })

    await CreateAllCommandSourceFiles({
        commandsDirPath,
        executablesDefinition
    })

}


module.exports = CreateCommandsStruct
