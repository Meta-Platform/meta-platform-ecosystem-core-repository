const { resolve } = require("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile")

const CreateCommandGroupMetadataFile = async ({
    metadataDirPath,
    executablesDefinition
}) => {
    const filename = "command-group.json"
    const content = {
        "commands": executablesDefinition
            .reduce((acc, { commands: commandsDef }) => {
                const commands = commandsDef
                    .map(({ namespace, command, description}) => {
                        return { 
                            namespace, 
                            path: `Commands/${namespace}.command`,
                            command, 
                            description 
                        }
                    })
                return [...acc, ...commands ]
            }, [])
    }
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

module.exports = CreateCommandGroupMetadataFile