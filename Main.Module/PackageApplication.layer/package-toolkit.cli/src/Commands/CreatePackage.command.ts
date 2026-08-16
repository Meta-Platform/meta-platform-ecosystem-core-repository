const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"

// Criadores dedicados por ext; demais tipos usam o scaffold genérico.
const DEDICATED: Record<string, string> = { lib: "CreateLibPackage", cli: "CreateCliPackage", service: "CreateServicesPackage" }

// Cria um pacote de qualquer tipo no diretório atual (mesma lógica do Package Developer).
const CreatePackageCommand = async ({ args, startupParams, params }: any) => {
    const { packageName, ext } = args
    if(packageName === undefined || ext === undefined) throw "Uso: create package <packageName> <ext>"

    const { PKG_CONF_DIRNAME_METADATA } = startupParams
    const { packageToolkitLib } = params
    const workingDirPath = process.cwd()

    let packagePath: string
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
    Log.message("CreatePackage", `Pacote criado: ${packagePath}`)
}

module.exports = CreatePackageCommand
