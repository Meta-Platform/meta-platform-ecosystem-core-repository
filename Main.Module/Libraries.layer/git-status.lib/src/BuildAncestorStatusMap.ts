import type { AncestorStatusMap, DirtyFile } from "./Types"

const path = require("path") as typeof import("path")

const MAX_FILES_PER_NODE = 50   // limite de amostra por nó (tooltip)

/**
 * Constrói um mapa `caminho absoluto -> status` propagando cada arquivo sujo
 * para TODOS os seus diretórios ancestrais, do diretório-pai do arquivo até a
 * raiz do repositório (inclusive). Assim um pacote, group, layer, module ou o
 * próprio repositório fica marcado quando contém qualquer alteração — e um
 * arquivo solto (fora de pacote) marca o diretório que o contém.
 *
 * A contagem (`count`) é o total de arquivos sujos sob aquele diretório.
 *
 */
const BuildAncestorStatusMap = (repositoryPath: string, files: DirtyFile[]): AncestorStatusMap => {
    const root = repositoryPath.replace(/[\\/]+$/, "")
    const acc: Record<string, { count: number, states: Record<string, true>, files: string[] }> = {}

    const mark = (dir: string, state: string, relFile: string) => {
        const node = acc[dir] || (acc[dir] = { count: 0, states: {}, files: [] })
        node.count++
        if(state) node.states[state] = true
        if(node.files.length < MAX_FILES_PER_NODE) node.files.push(relFile)
    }

    for(const { path: relPath, state } of files){
        const abs = path.resolve(root, relPath)
        let dir = path.dirname(abs)
        // Sobe do diretório-pai do arquivo até a raiz do repositório (inclusive).
        while(true){
            mark(dir, state, relPath)
            if(dir === root) break
            const parent = path.dirname(dir)
            if(parent === dir || !dir.startsWith(root)) break
            dir = parent
        }
    }

    const out: AncestorStatusMap = {}
    for(const dir of Object.keys(acc))
        out[dir] = {
            dirty: true,
            count: acc[dir].count,
            states: Object.keys(acc[dir].states),
            files: acc[dir].files
        }
    return out
}

module.exports = BuildAncestorStatusMap
