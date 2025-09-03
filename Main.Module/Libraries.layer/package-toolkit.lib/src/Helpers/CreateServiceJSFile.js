const { resolve } = require("path")

const FILE_EXT = "js"

const CreateUtf8TextFile = require("../Utils/CreateUtf8TextFile")

const CreateServiceJSFile = async ({ servicesDirPath, namespace, params, boundParams }) => {

    const fileName = `${namespace}.command.${FILE_EXT}`
    const filePath = resolve(servicesDirPath, fileName)

     const paramsBlock = [...params, ...boundParams].map(p => `        ${p},`).join("\n")

    const content = `

const ${namespace}Service = (params) => {

const {
${paramsBlock}
        onReady 
    } = params

    onReady()
    
}

module.exports = ${namespace}Service
`
    await CreateUtf8TextFile(filePath, content)
    
}


module.exports = CreateServiceJSFile