const inquirer = require('inquirer').default

const CreateNewPackageCommand = async ({ args, startupParams, params }) => {
    console.log(startupParams)
    console.log(params)

    try {
        const { namespace } = args

        if(namespace === undefined) throw "O namespace é obrigatório"

        const { packageType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'packageType',
                message: 'Qual tipo de pacote você deseja criar?',
                choices: ['lib', 'service', 'webservice', 'webgui', 'webapp', 'app', 'cli'],
                default: 'lib'
            }
        ])

        if(packageType === "lib"){

        }

    } catch (error) {
        throw error
    }
}

module.exports = CreateNewPackageCommand