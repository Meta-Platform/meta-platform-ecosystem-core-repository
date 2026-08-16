import type { ServiceDefinition } from "../Types"

const CreateServiceSourceFile = require("./CreateServiceSourceFile") as (options: { servicesDirPath: string, namespace: string, params: string[], boundParams: string[] }) => Promise<void>

const CreateAllServiceSourceFiles = async ({
    servicesDefinition,
    servicesDirPath
}: {
    servicesDefinition: ServiceDefinition[]
    servicesDirPath: string
}) => {
    const fileCreatedPromises = servicesDefinition
        .map(({ namespace, params, boundParams }) => {
            return CreateServiceSourceFile({ servicesDirPath, namespace, params, boundParams })
        })

    await Promise.all(fileCreatedPromises)
}

module.exports = CreateAllServiceSourceFiles