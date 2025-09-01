const colors = require("colors")
const { resolve } = require("path")
const { 
    mkdir
} = require('node:fs/promises')

const WriteObjectToFile = require("./Utils/WriteObjectToFile")
const CreateUtf8TextFile = require("./Utils/CreateUtf8TextFile")

const EXT_TYPE = "lib"

const NODEJS_PACKAGE_JSON_FILENAME = "package.json"

const NODEJS_PACKAGE_JSON_CONTENT = {
    "version": "0.0.1",
    "license": "BSD-3-Clause"
}

const GITIGNORE_FILENAME = ".gitignore"

const GITIGNORE_CONTENT = `
node_modules
`

const CreateMetadata = async ({packageBasePath, PKG_CONF_DIRNAME_METADATA}) => {
    const metadataDirPath = resolve(packageBasePath, PKG_CONF_DIRNAME_METADATA)
    await mkdir(metadataDirPath, { recursive: true })
}

const CreateLibPackage = async ({
    namespace,
    workingDirPath,
    author,
    license,
    PKG_CONF_DIRNAME_METADATA
}) => {

    const basePath = resolve(workingDirPath, `${namespace}.${EXT_TYPE}`)

    const srcPath = resolve(basePath, "src")

    await mkdir(srcPath, { recursive: true })

    loggerEmitter && loggerEmitter.emit("log", {
            sourceName: "CreateLibPackage",
            type: "info",
            message: `O diretório base do pacote foi criado em ${colors.bold(srcPath)}`
        })

    const nodejsPackageJsonFilePath = revolve(basePath, NODEJS_PACKAGE_JSON_FILENAME)

    const nodejsPackageJsonContent = {
        author,
        license,
        ...NODEJS_PACKAGE_JSON_CONTENT
    }

    await WriteObjectToFile(nodejsPackageJsonFilePath, nodejsPackageJsonContent)
    const gitignoreFilePath = resolve(basePath, GITIGNORE_FILENAME)
    await CreateUtf8TextFile(gitignoreFilePath, GITIGNORE_CONTENT)

    await CreateMetadata({
        packageBasePath: basePath,
        PKG_CONF_DIRNAME_METADATA
    })
	
}
module.exports = CreateLibPackage