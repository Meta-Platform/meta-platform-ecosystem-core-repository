const colors = require("colors")
const { resolve } = require("path")
const { 
    mkdir
} = require('node:fs/promises')

const EXT_TYPE = "lib"

const CreateLibPackage = async ({
    namespace,
    workingDirPath
}) => {

    const packageSourceCodePath = resolve(workingDirPath, `${namespace}.${EXT_TYPE}`, "src")

    await mkdir(packageSourceCodePath, { recursive: true })

    loggerEmitter && loggerEmitter.emit("log", {
            sourceName: "CreateLibPackage",
            type: "info",
            message: `O diretório base do pacote foi criado em ${colors.bold(packageSourceCodePath)}`
        })

    //Criar package.json
    //Criar .gitignore
    //Criar Metadados
	
}
module.exports = CreateLibPackage