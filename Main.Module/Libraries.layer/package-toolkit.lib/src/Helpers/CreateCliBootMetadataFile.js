const { resolve } = require("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile")

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

module.exports = CreateCliBootMetadataFile