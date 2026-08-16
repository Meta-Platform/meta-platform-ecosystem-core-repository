const { resolve } = require("path") as typeof import("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile") as (filepath: string, objectContent: unknown) => Promise<void>

const CreatePackageMetadataFile = async({
    namespace,
    metadataDirPath
}: {
    namespace: string
    metadataDirPath: string
}) => {
    const filename = "package.json"
    const content = {
        namespace: `@/${namespace}`
    }
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

module.exports = CreatePackageMetadataFile