import type { ExecutableDefinition } from "../Types"

const CreateCommandJSFile = require("./CreateCommandJSFile") as (options: { commandsDirPath: string, namespace: string }) => Promise<void>

const CreateAllCommandJSFile = async ({
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
                        return CreateCommandJSFile({ commandsDirPath, namespace })
                    })
                return [...acc, ...fileCreatedPromises ]
            }, [])

    await Promise.all(fileCreatedPromises)
}

module.exports = CreateAllCommandJSFile