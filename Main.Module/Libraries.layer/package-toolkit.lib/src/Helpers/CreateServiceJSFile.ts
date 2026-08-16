const { resolve } = require("path") as typeof import("path")

const FILE_EXT = "js"

const CreateUtf8TextFile = require("../Utils/CreateUtf8TextFile") as (filePath: string, content: string) => Promise<void>

const CreateServiceJSFile = async ({ servicesDirPath, namespace, params, boundParams }: { servicesDirPath: string, namespace: string, params: string[], boundParams: string[] }) => {

    const fileName = `${namespace}.service.${FILE_EXT}`
    const filePath = resolve(servicesDirPath, fileName)

     const paramsBlock = [...params, ...boundParams].map(p => `        ${p},`).join("\n")

    const content = `

const ${namespace}Service = (params) => {

const {
${paramsBlock}
        onReady 
    } = params

    onReady()
    

    return {}
}

module.exports = ${namespace}Service
`
    await CreateUtf8TextFile(filePath, content)
    
}


module.exports = CreateServiceJSFile