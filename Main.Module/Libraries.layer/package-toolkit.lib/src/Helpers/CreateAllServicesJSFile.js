const CreateServiceJSFile = require("./CreateServiceJSFile")

const CreateAllServicesJSFile = async ({
    servicesDefinition,
    servicesDirPath
}) => {
    const fileCreatedPromises = servicesDefinition
        .map(({ namespace, params, boundParams }) => {
            return CreateServiceJSFile({ servicesDirPath, namespace, params, boundParams })
        })

    await Promise.all(fileCreatedPromises)
}

module.exports = CreateAllServicesJSFile