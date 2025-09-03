const { resolve } = require("path")

const { 
    mkdir
} = require('node:fs/promises')


const CreateServicesMetadataFile = require("./CreateServicesMetadataFile")
//const CreateAllServicesJSFile = require("./CreateAllServicesJSFile")

const CreateServicesStruct = async ({
    srcPath,
    metadataDirPath,
    servicesDefinition
}) => {


    await CreateServicesMetadataFile({
        metadataDirPath,
        servicesDefinition
    })

    const servicesDirPath = resolve(srcPath, "Services")
    await mkdir(servicesDirPath, { recursive: true })
/*
    await CreateAllServicesJSFile({
        servicesDirPath,
        executablesDefinition
    })*/

}


module.exports = CreateServicesStruct
