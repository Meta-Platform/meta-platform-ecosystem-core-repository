const { resolve } = require("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile")

const CreateServicesMetadataFile = async ({
    metadataDirPath,
    servicesDefinition
}) => {
    const filename = "services.json"
    const content = []
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

module.exports = CreateServicesMetadataFile