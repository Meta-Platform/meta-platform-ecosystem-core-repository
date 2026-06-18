const inquirer = require('inquirer').default

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const IsCamelCase = (str) => {
    return /^[A-Z][A-Za-z0-9]*$/.test(str)
}

const CreateLibraryPackageCommand = async ({ args, startupParams, params }) => {
   
    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    
    const { packageToolkitLib } = params
    
    try {
        const { packageName } = args

        if(packageName === undefined) throw "O packageName é obrigatório"

        const CreateLibPackage = packageToolkitLib.require("CreateLibPackage")
        const AddEmptyJSFunctionToPackageSrc = packageToolkitLib.require("AddEmptyJSFunctionToPackageSrc")


        const workingDirPath = process.cwd()

        const packagePath = await CreateLibPackage({
            packageName,
            workingDirPath,
            author: AUTHOR,
            PKG_CONF_DIRNAME_METADATA
        })

        const { wantFunction } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'wantFunction',
                message: 'Deseja criar uma função na biblioteca lib?',
                default: true
            }
        ])

        while (wantFunction) {

            const { newFunctionName } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'newFunctionName',
                    message: 'Digite o nome da função (CamelCase):',
                    validate: (input) => {
                        if (!IsCamelCase(input)) {
                            return 'O nome da função deve estar em CamelCase (ex: MyFunction, DoSomething).'
                        }
                        return true
                    }
                }
            ])
            await AddEmptyJSFunctionToPackageSrc({ packagePath, functionName: newFunctionName})

            const { wantAnotherFunction } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'wantAnotherFunction',
                    message: 'Deseja criar outra função?',
                    default: false
                }
            ])

            if(!wantAnotherFunction) break

        }

    } catch (error) {
        throw error
    }
}

module.exports = CreateLibraryPackageCommand