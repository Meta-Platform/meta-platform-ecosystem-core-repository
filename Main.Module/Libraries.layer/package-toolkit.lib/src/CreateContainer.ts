const { mkdir, access } = require("node:fs/promises") as typeof import("node:fs/promises")
const { resolve } = require("path") as typeof import("path")

// Sufixo de diretório por tipo de container da hierarquia Meta Platform.
const SUFFIX: Record<string, string> = {
    module: ".Module",
    layer : ".layer",
    group : ".group"
}

// Cria um container da hierarquia (<parentPath>/<name><sufixo>). Recusa existente.
const CreateContainer = async ({ parentPath, name, kind }: { parentPath: string, name: string, kind: string }) => {

    const suffix = SUFFIX[kind]
    if(!suffix) throw `Tipo de container inválido: "${kind}" (use module | layer | group)`
    if(!name || name.trim() === "") throw "Nome obrigatório"

    const dirPath = resolve(parentPath, `${name.trim()}${suffix}`)

    try {
        await access(dirPath)
        throw `"${dirPath}" já existe`
    } catch (e) {
        if(typeof e === "string") throw e
    }

    await mkdir(dirPath, { recursive: true })
    return dirPath
}

module.exports = CreateContainer
