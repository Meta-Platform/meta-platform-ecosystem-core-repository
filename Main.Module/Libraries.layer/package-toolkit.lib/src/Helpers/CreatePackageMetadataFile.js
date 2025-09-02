const { resolve } = require("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile")

const CreatePackageMetadataFile = async({
    namespace,
    metadataDirPath
}) => {
    const filename = "package.json"
    const content = {
        namespace: `@/${namespace}`
    }
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

module.exports = CreatePackageMetadataFile