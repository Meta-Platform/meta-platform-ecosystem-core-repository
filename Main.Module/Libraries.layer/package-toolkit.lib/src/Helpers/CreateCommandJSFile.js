const { resolve } = require("path")

const FILE_EXT = "js"

const CreateUtf8TextFile = require("../Utils/CreateUtf8TextFile")

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


module.exports = CreateCommandJSFile