const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

// Criadores dedicados por ext; demais tipos usam o scaffold genérico.
const DEDICATED = { lib: "CreateLibPackage", cli: "CreateCliPackage", service: "CreateServicesPackage" }

// Cria um pacote de qualquer tipo no diretório atual (mesma lógica do Package Developer).
const CreatePackageCommand = async ({ args, startupParams, params }) => {
    const { packageName, ext } = args
    if(packageName === undefined || ext === undefined) throw "Uso: create package <packageName> <ext>"

    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    const { packageToolkitLib } = params
    const workingDirPath = process.cwd()

    let packagePath
    if(DEDICATED[ext]){
        const CreatePackage = packageToolkitLib.require(DEDICATED[ext])
        packagePath = await CreatePackage({ packageName, workingDirPath, author: AUTHOR, PKG_CONF_DIRNAME_METADATA })
    } else {
        const { resolve } = require("path")
        const CreateBasePackage = packageToolkitLib.require("Helpers/CreateBasePackage")
        const namespace = `${packageName}.${ext}`
        packagePath = resolve(workingDirPath, namespace)
        await CreateBasePackage({ basePath: packagePath, namespace, author: AUTHOR, PKG_CONF_DIRNAME_METADATA })
    }
    console.log(`Pacote criado: ${packagePath}`)
}

module.exports = CreatePackageCommand
