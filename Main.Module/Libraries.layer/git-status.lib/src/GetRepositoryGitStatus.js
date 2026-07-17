const { execFile } = require("child_process")

// Executa `git` no diretório do repositório e resolve o stdout (ou rejeita).
const RunGit = (args, cwd) => new Promise((resolve, reject) => {
    execFile("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
        if(error) return reject(error)
        resolve(stdout)
    })
})

// Traduz os dois caracteres de estado do porcelain (XY: X=index, Y=working tree)
// para um rótulo simples usado na UI (tooltip/cores).
const Classify = (xy) => {
    if(xy === "??")                                   return "untracked"
    if(xy[0] === "U" || xy[1] === "U" || xy === "AA" || xy === "DD") return "conflicted"
    if(xy[1] !== " ")                                 return "modified"   // alteração no working tree
    if(xy[0] !== " ")                                 return "staged"     // apenas no index
    return "modified"
}

// Parseia a saída de `git status --porcelain=v1 -z`. Com -z cada entrada é
// terminada por NUL; renomeações/cópias trazem o caminho de origem num token
// extra (consumido a seguir).
const ParsePorcelainZ = (stdout) => {
    const tokens = stdout.split("\0")
    const files = []
    for(let i = 0; i < tokens.length; i++){
        const entry = tokens[i]
        if(!entry || entry.length < 3) continue
        const xy   = entry.slice(0, 2)
        const file = entry.slice(3)
        if(xy[0] === "R" || xy[0] === "C") i++   // pula o caminho de origem do rename/copy
        files.push({ path: file, state: Classify(xy) })
    }
    return files
}

/**
 * Lê o estado do git de um repositório: se é um repo, o branch atual e a lista
 * de arquivos "sujos" (não commitados) — modificados, staged, em conflito e
 * não rastreados (`-uall` lista arquivos individuais, não só diretórios).
 *
 * Nunca lança: um diretório sem git resolve `{ isRepo:false, branch:null, files:[] }`.
 *
 * @param {string} repositoryPath  raiz do repositório
 * @returns {Promise<{isRepo:boolean, branch:(string|null), files:Array<{path:string,state:string}>}>}
 */
const GetRepositoryGitStatus = async (repositoryPath) => {
    try {
        await RunGit(["rev-parse", "--is-inside-work-tree"], repositoryPath)
    } catch(e) {
        return { isRepo: false, branch: null, files: [] }
    }

    let branch = null
    try {
        const raw = (await RunGit(["rev-parse", "--abbrev-ref", "HEAD"], repositoryPath)).trim()
        branch = raw === "HEAD" ? "(detached)" : raw
    } catch(e) { branch = null }

    let files = []
    try {
        files = ParsePorcelainZ(await RunGit(["status", "--porcelain=v1", "-z", "-uall"], repositoryPath))
    } catch(e) { files = [] }

    return { isRepo: true, branch, files }
}

module.exports = GetRepositoryGitStatus
