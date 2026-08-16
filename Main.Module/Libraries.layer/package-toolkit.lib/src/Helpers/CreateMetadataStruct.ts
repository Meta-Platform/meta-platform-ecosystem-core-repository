const { resolve } = require("path") as typeof import("path")
const { 
    mkdir
} = require('node:fs/promises') as typeof import('node:fs/promises')

const CreatePackageMetadataFile = require("./CreatePackageMetadataFile") as (options: { metadataDirPath: string, namespace: string }) => Promise<void>

const CreateMetadataStruct = async ({
    namespace,
    packageBasePath,
    PKG_CONF_DIRNAME_METADATA
}: {
    namespace: string
    packageBasePath: string
    PKG_CONF_DIRNAME_METADATA: string
}) => {
    const metadataDirPath = resolve(packageBasePath, PKG_CONF_DIRNAME_METADATA)
    await mkdir(metadataDirPath, { recursive: true })
    await CreatePackageMetadataFile({ metadataDirPath, namespace })

    return metadataDirPath
}

module.exports = CreateMetadataStruct