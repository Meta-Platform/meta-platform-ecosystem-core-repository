import type { CommandDefinition, ExecutableDefinition } from "../Types"

const { resolve } = require("path") as typeof import("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile") as (filepath: string, objectContent: unknown) => Promise<void>

const CreateCommandGroupMetadataFile = async ({
    metadataDirPath,
    executablesDefinition
}: {
    metadataDirPath: string
    executablesDefinition: ExecutableDefinition[]
}) => {
    const filename = "command-group.json"
    const content = {
        "commands": executablesDefinition
            .reduce((acc: unknown[], { commands: commandsDef }) => {
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