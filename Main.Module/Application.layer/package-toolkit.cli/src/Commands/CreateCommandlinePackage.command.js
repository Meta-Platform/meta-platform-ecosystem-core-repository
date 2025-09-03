const inquirer = require('inquirer').default

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const IsValidExecutableName = (str) => {
    return /^[a-z0-9-_]+$/.test(str)
}

const IsCamelCase = (str) => {
    return /^[A-Z][A-Za-z0-9]*$/.test(str)
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
                executableName: newExecutableName,
                commands: []
            }
        ]

        const { wantCommand } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'wantCommand',
                    message: `Deseja criar um novo comando para [${executablesDefinitionForCreate[0].executableName}]?`,
                    default: true
                }
            ])

        if(wantCommand){
            
            while(true){
                
                const { newCommandNamespace } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'newCommandNamespace',
                        message: `[${executablesDefinitionForCreate[0].executableName}] Digite o namespace (padrão CamelCase) do comando:`,
                        validate: (input) => {
                            if (!IsCamelCase(input)) {
                                return 'O namespace do comando deve estar em CamelCase (ex: ListDirectory, DoSomething, CreateFile, Execute, etc...).'
                            }
                            return true
                        }
                    }
                ])

                const { newComand } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'newComand',
                        message: `[${executablesDefinitionForCreate[0].executableName}][${newComandNamespace}] Digite o comando:`,
                        validate: (input) => {
                            if (!input || input==="") {
                                return 'O comando não poder vazio.'
                            }
                            return true
                        }
                    }
                ])

                const { newDescription } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'newDescription',
                        message: `[${executablesDefinitionForCreate[0].executableName}][${newComandNamespace}][${newComand}] Digite uma breve descrição do comando:`,
                        validate: (input) => {
                            if (!input || input==="") {
                                return 'A descrição do comando não poder vazio.'
                            }
                            return true
                        }
                    }
                ])

                executablesDefinitionForCreate[0].commands.push({
                    namespace: newComandNamespace,
                    command: newComand,
                    description: newDescription
                })
                
                const { wantCommand } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'wantCommand',
                        message: `Deseja criar mais um comando para [${executablesDefinitionForCreate[0].executableName}]?`,
                        default: true
                    }
                ])

                if(!wantCommand) break
            }
        }

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