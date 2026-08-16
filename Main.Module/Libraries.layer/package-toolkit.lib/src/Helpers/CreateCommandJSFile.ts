const { resolve } = require("path") as typeof import("path")

const FILE_EXT = "js"

const CreateUtf8TextFile = require("../Utils/CreateUtf8TextFile") as (filePath: string, content: string) => Promise<void>

const CreateCommandJSFile = async ({ commandsDirPath, namespace}: { commandsDirPath: string, namespace: string }) => {

    const fileName = `${namespace}.command.${FILE_EXT}`
    const filePath = resolve(commandsDirPath, fileName)

    const content = `

const ${namespace}Command = async ({ args, startupParams, params }) => {
   
    
}

module.exports = ${namespace}Command
`
    await CreateUtf8TextFile(filePath, content)
    
}


module.exports = CreateCommandJSFile