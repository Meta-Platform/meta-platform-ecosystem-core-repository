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
                message: 'Deseja adicionar um serviço ao seu pacote?',
                default: true
            }
        ])

        if(wantService){
            while(true){
                const { newServiceNamespace } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'newServiceNamespace',
                        message: `Digite o namespace do serviço (CamelCase):`,
                        validate: (input) => {
                            if (!IsCamelCase(input)) {
                                return 'O namespace do serviço deve estar em CamelCase  (ex: DatabaseManager, ServerMgt, etc...).'
                            }
                            return true
                        }
                    }
                ])

                const newParams = []

                const { wantParams } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'wantParams',
                            message: `Deseja adicionar parâmetros ao serviço [${newServiceNamespace}]?`,
                            default: true
                        }
                    ])
                if(wantParams){
                    while(true){
                        const { newParam } = await inquirer.prompt([
                            {
                                type: 'input',
                                name: 'newParam',
                                message: `[${newServiceNamespace}] Digite o nome do parâmetro:`,
                                validate: (input) => {
                                    if (!input || input==="") {
                                        return 'O nome do parâmetro não poder vazio.'
                                    }
                                    return true
                                }
                            }
                        ])

                        newParams.push(newParam)

                        const { wantContinueParams } = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'wantContinueParams',
                                message: `[${newServiceNamespace}] Deseja adicionar mais parâmetro?`,
                                default: true
                            }
                        ])

                        if(!wantContinueParams) break

                    }
                }

                const newBoundParams = []

                const { wantBoundParams } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'wantBoundParams',
                            message: `Deseja adicionar parâmetros-vinculados ao serviço [${newServiceNamespace}]?`,
                            default: true
                        }
                    ])
                if(wantBoundParams){
                    while(true){
                        const { newBoundParam } = await inquirer.prompt([
                            {
                                type: 'input',
                                name: 'newBoundParam',
                                message: `[${newServiceNamespace}] Digite o nome do parâmetro-vinculado:`,
                                validate: (input) => {
                                    if (!input || input==="") {
                                        return 'O nome do parâmetro-vinculado não poder vazio.'
                                    }
                                    return true
                                }
                            }
                        ])

                        newBoundParams.push(newBoundParam)

                        const { wantContinueBoundParams } = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'wantContinueBoundParams',
                                message: `[${newServiceNamespace}] Deseja adicionar mais parâmetro-vinculado?`,
                                default: true
                            }
                        ])

                        if(!wantContinueBoundParams) break

                    }
                }

                servicesDefinition.push({
                    namespace: newServiceNamespace,
                    params: newParams,
                    boundParams: newBoundParams
                })

                const { wantContinueService } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'wantContinueService',
                        message: 'Deseja adicionar mais um serviço ao seu pacote?',
                        default: true
                    }
                ])

                if(!wantContinueService) break
                
            }
        }

        console.log(servicesDefinition)

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