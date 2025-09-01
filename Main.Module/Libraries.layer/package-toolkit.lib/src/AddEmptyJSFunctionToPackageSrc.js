
const { resolve } = require("path")

const FILE_EXT = "js"

const CreateUtf8TextFile = require("./Utils/CreateUtf8TextFile")

const AddEmptyJSFunctionToPackageSrc = async ({ packagePath, functionName}) => {

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
module.exports = AddEmptyJSFunctionToPackageSrc