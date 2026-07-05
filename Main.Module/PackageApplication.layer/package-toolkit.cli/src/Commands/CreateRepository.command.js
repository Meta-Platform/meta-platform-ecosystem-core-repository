// Cria um Repository do zero (scaffold) no diretório atual (compartilha o scaffold
// com o Package Developer via package-toolkit.lib).
const CreateRepositoryCommand = async ({ args, params }) => {
    const { name } = args
    if(name === undefined) throw "O nome do repositório é obrigatório"

    const { packageToolkitLib } = params
    const CreateRepositoryStruct = packageToolkitLib.require("CreateRepositoryStruct")

    const repositoryPath = await CreateRepositoryStruct({ basePath: process.cwd(), name })
    console.log(`Repositório criado: ${repositoryPath}`)
}

module.exports = CreateRepositoryCommand
