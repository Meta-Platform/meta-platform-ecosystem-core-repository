const inquirer = require('inquirer').default

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const IsCamelCase = (str) => {
    return /^[A-Z][A-Za-z0-9]*$/.test(str)
}

const CreateServicePackageCommand = async ({ args, startupParams, params }) => {
   
    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    
    const { packageToolkitLib } = params
    
    try {
        const { packageName } = args

        if(packageName === undefined) throw "O packageName é obrigatório"

        const CreateServicePackage = packageToolkitLib.require("CreateServicePackage")

        const workingDirPath = process.cwd()

        const packagePath = await CreateLibPackage({
            packageName,
            workingDirPath,
            author: AUTHOR,
            PKG_CONF_DIRNAME_METADATA
        })

       

    } catch (error) {
        throw error
    }
}

module.exports = CreateServicePackageCommand