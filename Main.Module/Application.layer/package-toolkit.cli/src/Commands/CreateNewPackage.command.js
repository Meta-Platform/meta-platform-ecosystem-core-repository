const inquirer = require('inquirer').default


const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

const CreateNewPackageCommand = async ({ args, startupParams, params }) => {
   
    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    
    const { packageToolkitLib } = params
    
    try {
        const { namespace } = args

        if(namespace === undefined) throw "O namespace é obrigatório"

        const CreateLibPackage = packageToolkitLib.require("CreateLibPackage")

        const { packageType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'packageType',
                message: 'Qual tipo de pacote você deseja criar?',
                choices: ['lib', 'service', 'webservice', 'webgui', 'webapp', 'app', 'cli'],
                default: 'lib'
            }
        ])

        const workingDirPath = process.cwd()

        if(packageType === "lib"){
            await CreateLibPackage({
                namespace,
                workingDirPath,
                author: AUTHOR,
                PKG_CONF_DIRNAME_METADATA
            })
        }

    } catch (error) {
        throw error
    }
}

module.exports = CreateNewPackageCommand