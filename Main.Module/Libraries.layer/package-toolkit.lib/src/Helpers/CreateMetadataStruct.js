const { resolve } = require("path")
const { 
    mkdir
} = require('node:fs/promises')

const CreatePackageMetadataFile = require("./CreatePackageMetadataFile")

const CreateMetadataStruct = async ({
    namespace,
    packageBasePath,
    PKG_CONF_DIRNAME_METADATA
}) => {
    const metadataDirPath = resolve(packageBasePath, PKG_CONF_DIRNAME_METADATA)
    await mkdir(metadataDirPath, { recursive: true })
    await CreatePackageMetadataFile({ metadataDirPath, namespace })
}

module.exports = CreateMetadataStruct