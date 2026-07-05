// Cria um container da hierarquia (Module/Layer/Group) no diretório atual.
const CreateContainerCommand = async ({ args, params }) => {
    const { kind, name } = args
    if(kind === undefined || name === undefined) throw "Uso: create container <module|layer|group> <name>"

    const { packageToolkitLib } = params
    const CreateContainer = packageToolkitLib.require("CreateContainer")

    const dirPath = await CreateContainer({ parentPath: process.cwd(), name, kind })
    console.log(`${kind} criado: ${dirPath}`)
}

module.exports = CreateContainerCommand
