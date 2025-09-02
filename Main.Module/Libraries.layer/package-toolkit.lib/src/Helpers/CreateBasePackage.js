const { resolve } = require("path")
const { 
    mkdir
} = require('node:fs/promises')

const WriteObjectToFile = require("../Utils/WriteObjectToFile")
const CreateUtf8TextFile = require("../Utils/CreateUtf8TextFile")

const NODEJS_PACKAGE_JSON_FILENAME = "package.json"

const NODEJS_PACKAGE_JSON_CONTENT = {
    "version": "0.0.1",
    "license": "BSD-3-Clause"
}

const GITIGNORE_FILENAME = ".gitignore"

const GITIGNORE_CONTENT = `
node_modules
`
const CreateMetadataStruct = require("./CreateMetadataStruct")

const CreateBasePackage = async ({
    basePath,
    namespace,
    author,
    PKG_CONF_DIRNAME_METADATA
}) => {

    const srcPath = resolve(basePath, "src")

    await mkdir(srcPath, { recursive: true })

    const nodejsPackageJsonFilePath = resolve(basePath, NODEJS_PACKAGE_JSON_FILENAME)

    const nodejsPackageJsonContent = {
        name: namespace,
        author,
        ...NODEJS_PACKAGE_JSON_CONTENT
    }

    await WriteObjectToFile(nodejsPackageJsonFilePath, nodejsPackageJsonContent)
    const gitignoreFilePath = resolve(basePath, GITIGNORE_FILENAME)
    await CreateUtf8TextFile(gitignoreFilePath, GITIGNORE_CONTENT)

    await CreateMetadataStruct({
        namespace,
        packageBasePath: basePath,
        PKG_CONF_DIRNAME_METADATA
    })
	
}
module.exports = CreateBasePackage