const { resolve, relative, dirname, join, sep } = require("path") as typeof import("path")
const { writeFile, access } = require("node:fs/promises") as typeof import("node:fs/promises")

const CONFIG_FILENAME = "tsconfig.json"
const BASE_FILENAME   = "tsconfig.base.json"
const TYPES_DIRNAME   = "types"

/*
    Um pacote novo nasce em TypeScript, e o que torna isso verificável é este
    arquivo: sem ele o pacote é invisível para o `verify-typescript`, e a
    checagem passaria a mentir por omissão — nenhum erro acusado porque ninguém
    olhou.

    O `tsconfig.base.json` fica na raiz do REPOSITÓRIO, e a profundidade até lá
    varia (um pacote dentro de um `.group` está um nível mais fundo). Em vez de
    contar níveis, subimos procurando o arquivo — quem sabe onde a raiz está é a
    própria raiz.
*/
const _FindRepositoryRoot = async (startPath: string): Promise<string | undefined> => {

    let current = resolve(startPath)

    while(true){
        try{
            await access(join(current, BASE_FILENAME))
            return current
        }catch(e){ /* não é aqui: sobe */ }

        const parent = dirname(current)
        if(parent === current) return undefined
        current = parent
    }
}

/** Caminho relativo em POSIX — é o dialeto de um tsconfig, em qualquer SO. */
const _ToPosix = (path: string) => path.split(sep).join("/")

/**
 * Escreve o `tsconfig.json` do pacote em `basePath`.
 *
 * Devolve o caminho escrito, ou `undefined` quando o pacote não está dentro de
 * um repositório com base de verificação — caso em que não há o que estender, e
 * inventar um tsconfig solto seria pior do que não ter nenhum.
 */
const CreateTypeScriptConfigFile = async ({ basePath }: { basePath: string }): Promise<string | undefined> => {

    const repositoryRoot = await _FindRepositoryRoot(basePath)
    if(!repositoryRoot) return undefined

    const toRoot = _ToPosix(relative(basePath, repositoryRoot))

    const content = {
        extends: `${toRoot}/${BASE_FILENAME}`,
        include: ["src/**/*.ts", `${toRoot}/${TYPES_DIRNAME}/**/*.d.ts`]
    }

    const filePath = resolve(basePath, CONFIG_FILENAME)
    await writeFile(filePath, JSON.stringify(content, null, 4) + "\n", "utf-8")

    return filePath
}

module.exports = CreateTypeScriptConfigFile
