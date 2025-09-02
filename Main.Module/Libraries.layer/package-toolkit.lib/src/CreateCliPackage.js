const { resolve } = require("path")

const { 
    mkdir
} = require('node:fs/promises')

const FILE_EXT = "js"
const EXT_TYPE = "cli"

const CreateBasePackage = require("./Helpers/CreateBasePackage")
const WriteObjectToFile = require("./Utils/WriteObjectToFile")
const CreateUtf8TextFile = require("./Utils/CreateUtf8TextFile")

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

const CreateCommandJSFile = async ({ commandsDirPath, namespace}) => {

    const fileName = `${namespace}.command.${FILE_EXT}`
    const filePath = resolve(commandsDirPath, fileName)

    const content = `

const ${namespace} = async ({ args, startupParams, params }) => {
   
    
}

module.exports = ${namespace}
`
    await CreateUtf8TextFile(filePath, content)
    
}

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