const inquirer = require('inquirer').default

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const IsCamelCase = (str: any) => {
    return /^[A-Z][A-Za-z0-9]*$/.test(str)
}

const CreateLibraryPackageCommand = async ({ args, startupParams, params }: any) => {
   
    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    
    const { packageToolkitLib } = params
    
    try {
        const { packageName } = args

        if(packageName === undefined) throw "O packageName é obrigatório"

        const CreateLibPackage = packageToolkitLib.require("CreateLibPackage")
        const AddEmptyFunctionToPackageSrc = packageToolkitLib.require("AddEmptyFunctionToPackageSrc")


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
                    validate: (input: any) => {
                        if (!IsCamelCase(input)) {
                            return 'O nome da função deve estar em CamelCase (ex: MyFunction, DoSomething).'
                        }
                        return true
                    }
                }
            ])
            await AddEmptyFunctionToPackageSrc({ packagePath, functionName: newFunctionName})

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

    } catch(error: any) {
        throw error
    }
}

module.exports = CreateLibraryPackageCommand