import type { ExecutableDefinition } from "../Types"

const CreateCommandSourceFile = require("./CreateCommandSourceFile") as (options: { commandsDirPath: string, namespace: string }) => Promise<void>

const CreateAllCommandSourceFiles = async ({
    executablesDefinition,
    commandsDirPath
}: {
    executablesDefinition: ExecutableDefinition[]
    commandsDirPath: string
}) => {
    const fileCreatedPromises = executablesDefinition
            .reduce((acc: Promise<void>[], { commands: commandsDef }) => {
                const fileCreatedPromises = commandsDef
                    .map(({ namespace }) => {
                        return CreateCommandSourceFile({ commandsDirPath, namespace })
                    })
                return [...acc, ...fileCreatedPromises ]
            }, [])

    await Promise.all(fileCreatedPromises)
}

module.exports = CreateAllCommandSourceFiles