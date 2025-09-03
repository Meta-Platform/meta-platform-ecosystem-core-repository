const CreateCommandJSFile = require("./CreateCommandJSFile")

const CreateAllCommandJSFile = async ({
    executablesDefinition,
    commandsDirPath
}) => {
    const fileCreatedPromises = executablesDefinition
            .reduce((acc, { commands: commandsDef }) => {
                const fileCreatedPromises = commandsDef
                    .map(({ namespace }) => {
                        return CreateCommandJSFile({ commandsDirPath, namespace })
                    })
                return [...acc, ...fileCreatedPromises ]
            }, [])

    await Promise.all(fileCreatedPromises)
}

module.exports = CreateAllCommandJSFile