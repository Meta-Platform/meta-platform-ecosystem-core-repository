const { resolve } = require("path")

const EXT_TYPE = "cli"

const CreateBasePackage = require("./Helpers/CreateBasePackage")
const WriteObjectToFile = require("./Utils/WriteObjectToFile")

const CreateCliBootMetadataFile = async ({
    metadataDirPath,
    executablesDefinition
}) => {
    const filename = "boot.json"
    const content = {
        "executables":executablesDefinition.map(({executableName}) => {
            return {
                "dependency": "@//command-group",
                executableName
            }
        })
    }
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

const CreateCommandGroupMetadataFile = async ({
    metadataDirPath
}) => {
    const filename = "command-group.json"
    const content = {
        "commands": []
    }
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}


const CreateCommandsStruct = async ({
    metadataDirPath,
    executablesDefinition
}) => {

    await CreateCliBootMetadataFile({
        metadataDirPath,
        executablesDefinition
    })

    await CreateCommandGroupMetadataFile({
        metadataDirPath
    })

}

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
        metadataDirPath
    } = await CreateBasePackage({
        basePath,
        namespace,
        author,
        PKG_CONF_DIRNAME_METADATA
    })


    //executablesDefinition
    await CreateCommandsStruct({
        metadataDirPath,
        executablesDefinition
    })

    return basePath
	
}
module.exports = CreateCliPackage