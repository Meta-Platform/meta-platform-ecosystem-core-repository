
const { resolve } = require("path") as typeof import("path")

const FILE_EXT = "ts"

const CreateUtf8TextFile = require("./Utils/CreateUtf8TextFile") as (filePath: string, content: string) => Promise<void>

const AddEmptyFunctionToPackageSrc = async ({ packagePath, functionName}: { packagePath: string, functionName: string }) => {

    const fileName = `${functionName}.${FILE_EXT}`
    const filePath = resolve(packagePath, "src", fileName)

    const content = `

const ${functionName} = () => {

    return
}

module.exports = ${functionName}
`
    await CreateUtf8TextFile(filePath, content)
    
}
module.exports = AddEmptyFunctionToPackageSrc