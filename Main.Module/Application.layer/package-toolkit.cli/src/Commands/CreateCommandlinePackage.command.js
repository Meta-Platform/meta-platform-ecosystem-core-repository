const inquirer = require('inquirer').default

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const IsValidExecutableName = (str) => {
    return /^[a-z0-9-_]+$/.test(str)
}

const CreateCommandlinePackageCommand = async ({ args, startupParams, params }) => {
   
    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    
    const { packageToolkitLib } = params
    
    try {
        const { packageName } = args

        if(packageName === undefined) throw "O packageName é obrigatório"

        const CreateCliPackage = packageToolkitLib.require("CreateCliPackage")

        const workingDirPath = process.cwd()

        const { newExecutableName } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'newExecutableName',
                    message: 'Digite o nome do executável (ex: my-cli, tool, pacote):',
                    validate: (input) => {
                        if (!IsValidExecutableName(input)) {
                            return 'O nome do executável deve estar em minúsculo e conter apenas letras, números, "-" ou "_".'
                        }
                        return true
                    }
                }
            ])

        const executablesDefinitionForCreate = [
            {
                executableName: newExecutableName
            }
        ]

        const { wantCommand } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'wantCommand',
                    message: `Deseja criar um novo comando para [${executablesDefinitionForCreate[0].executableName}]?`,
                    default: false
                }
            ])

        await CreateCliPackage({
            packageName,
            workingDirPath,
            executablesDefinition: executablesDefinitionForCreate,
            author: AUTHOR,
            PKG_CONF_DIRNAME_METADATA
        })
       

    } catch (error) {
        throw error
    }
}

module.exports = CreateCommandlinePackageCommand