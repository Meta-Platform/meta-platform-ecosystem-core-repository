import type { ServiceDefinition } from "../Types"

const { resolve } = require("path") as typeof import("path")

const WriteObjectToFile = require("../Utils/WriteObjectToFile") as (filepath: string, objectContent: unknown) => Promise<void>

const CreateServicesMetadataFile = async ({
    metadataDirPath,
    servicesDefinition
}: {
    metadataDirPath: string
    servicesDefinition: ServiceDefinition[]
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