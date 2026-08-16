import type { ServiceDefinition } from "../Types"

const { resolve } = require("path") as typeof import("path")

const { 
    mkdir
} = require('node:fs/promises') as typeof import('node:fs/promises')

const CreateServicesMetadataFile = require("./CreateServicesMetadataFile") as (options: any) => Promise<void>
const CreateAllServicesJSFile = require("./CreateAllServicesJSFile") as (options: any) => Promise<void>

const CreateServicesStruct = async ({
    srcPath,
    metadataDirPath,
    servicesDefinition
}: {
    srcPath: string
    metadataDirPath: string
    servicesDefinition: ServiceDefinition[]
}) => {

    await CreateServicesMetadataFile({
        metadataDirPath,
        servicesDefinition
    })

    const servicesDirPath = resolve(srcPath, "Services")
    await mkdir(servicesDirPath, { recursive: true })

    await CreateAllServicesJSFile({
        servicesDirPath,
        servicesDefinition
    })

}


module.exports = CreateServicesStruct
