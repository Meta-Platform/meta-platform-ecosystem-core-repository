const { resolve } = require("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile")

const CreateServicesMetadataFile = async ({
    metadataDirPath,
    servicesDefinition
}) => {
    const filename = "services.json"
    const content = servicesDefinition
    .map(({ namespace, params, boundParams}) => {
        return {
            namespace,
            path: `Services/${namespace}.service`,
            ...Object.keys(boundParams).length > 0 ? { "bound-params": boundParams } : {},
            ...Object.keys(params).length > 0 ? { params } : {}
        }

    })
    const filePath = resolve(metadataDirPath, filename)
    await WriteObjectToFile(filePath, content)
}

module.exports = CreateServicesMetadataFile