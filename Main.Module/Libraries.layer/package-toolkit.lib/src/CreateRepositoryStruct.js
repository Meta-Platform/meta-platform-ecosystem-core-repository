const { mkdir, writeFile, access } = require("node:fs/promises")
const { resolve } = require("path")

// Cria a estrutura de um Repository novo em <basePath>/<name>:
// metadata/applications.json (marcador) + README + .gitignore + Module/Layer inicial.
const CreateRepositoryStruct = async ({ basePath, name }) => {

    const repositoryPath = resolve(basePath, name)

    try {
        await access(repositoryPath)
        throw `O diretório "${repositoryPath}" já existe`
    } catch (e) {
        if(typeof e === "string") throw e
    }

    await mkdir(resolve(repositoryPath, "metadata"), { recursive: true })
    await writeFile(
        resolve(repositoryPath, "metadata", "applications.json"),
        JSON.stringify([], null, 4) + "\n",
        "utf-8")
    await writeFile(resolve(repositoryPath, ".gitignore"), "node_modules\n", "utf-8")
    await writeFile(resolve(repositoryPath, "README.md"), `# ${name}\n`, "utf-8")
    await mkdir(resolve(repositoryPath, "Main.Module", "Application.layer"), { recursive: true })

    return repositoryPath
}

module.exports = CreateRepositoryStruct
