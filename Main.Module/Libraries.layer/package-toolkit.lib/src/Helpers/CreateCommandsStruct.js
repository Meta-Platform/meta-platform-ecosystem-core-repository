const { resolve } = require("path")

const { 
    mkdir
} = require('node:fs/promises')

const CreateCliBootMetadataFile = require("./CreateCliBootMetadataFile")
const CreateCommandGroupMetadataFile = require("./CreateCommandGroupMetadataFile")
const CreateAllCommandJSFile = require("./CreateAllCommandJSFile")

const CreateCommandsStruct = async ({
    srcPath,
    metadataDirPath,
    executablesDefinition
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

    await CreateAllCommandJSFile({
        commandsDirPath,
        executablesDefinition
    })

}


module.exports = CreateCommandsStruct
