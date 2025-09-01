const { resolve } = require("path")
const { 
    mkdir
} = require('node:fs/promises')

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

const CreateMetadata = async ({
    namespace,
    packageBasePath,
    PKG_CONF_DIRNAME_METADATA
}) => {
    const metadataDirPath = resolve(packageBasePath, PKG_CONF_DIRNAME_METADATA)
    await mkdir(metadataDirPath, { recursive: true })
    await CreatePackageMetadataFile({ metadataDirPath, namespace })
}

module.exports = CreateMetadata