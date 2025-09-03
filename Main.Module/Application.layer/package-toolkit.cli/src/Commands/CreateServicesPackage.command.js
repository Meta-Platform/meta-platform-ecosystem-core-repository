const inquirer = require('inquirer').default

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const IsCamelCase = (str) => {
    return /^[A-Z][A-Za-z0-9]*$/.test(str)
}

const CreateServicesPackageCommand = async ({ args, startupParams, params }) => {
   
    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    
    const { packageToolkitLib } = params
    
    try {
        const { packageName } = args

        if(packageName === undefined) throw "O packageName é obrigatório"

        const CreateServicesPackage = packageToolkitLib.require("CreateServicesPackage")

        const workingDirPath = process.cwd()


        const servicesDefinition = []

        const { wantService } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'wantService',
                message: 'Deseja deseja adicionar um serviço ao seu pacote?',
                default: true
            }
        ])

        const packagePath = await CreateServicesPackage({
            packageName,
            servicesDefinition,
            workingDirPath,
            author: AUTHOR,
            PKG_CONF_DIRNAME_METADATA
        })

    } catch (error) {
        throw error
    }
}

module.exports = CreateServicesPackageCommand