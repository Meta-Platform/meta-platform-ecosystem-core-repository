import type { ServiceDefinition } from "../Types"

const CreateServiceJSFile = require("./CreateServiceJSFile") as (options: { servicesDirPath: string, namespace: string, params: string[], boundParams: string[] }) => Promise<void>

const CreateAllServicesJSFile = async ({
    servicesDefinition,
    servicesDirPath
}: {
    servicesDefinition: ServiceDefinition[]
    servicesDirPath: string
}) => {
    const fileCreatedPromises = servicesDefinition
        .map(({ namespace, params, boundParams }) => {
            return CreateServiceJSFile({ servicesDirPath, namespace, params, boundParams })
        })

    await Promise.all(fileCreatedPromises)
}

module.exports = CreateAllServicesJSFile