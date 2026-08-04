const RunGit = require("./RunGit")

// Campos separados por US (0x1f) e registros por RS (0x1e): a mensagem do commit
// pode conter quebra de linha, tabulação e praticamente qualquer coisa — separar
// por caractere de controle é o que faz o parse não depender do que a pessoa
// escreveu no commit.
const US = "\x1f"
const RS = "\x1e"
const FORMAT = ["%H", "%h", "%an", "%ae", "%aI", "%s", "%b"].join(US) + RS

/**
 * Lê o HISTÓRICO de um repositório.
 *
 * A lib sabia responder "o que está sujo agora"; não sabia responder "o que foi
 * feito". A segunda pergunta é a que liga um commit ao trabalho que ele entrega.
 *
 * `grep` casa por texto LITERAL (--fixed-strings): a chave de um item é
 * "MPMR-5", e sem isso um prefixo com ponto ou parênteses viraria regex.
 *
 * Nunca lança: diretório sem git, ou intervalo sem commits, resolve `[]`.
 *
 * @param {object} options
 *   repositoryPath  raiz do repositório
 *   grep            texto literal a procurar na mensagem (ex.: a chave do item)
 *   since / until   janela de tempo (Date ou string ISO)
 *   author          filtro por autor
 *   paths           limita a commits que tocaram estes caminhos
 *   maxCount        teto de commits (padrão 200)
 * @returns {Promise<Array<{hash,shortHash,authorName,authorEmail,authorDate,subject,body}>>}
 */
const GetRepositoryGitLog = async ({
    repositoryPath, grep, since, until, author, paths, maxCount = 200
} = {}) => {
    const args = ["log", "--no-color", `--pretty=format:${FORMAT}`, `--max-count=${Number(maxCount) || 200}`]
    if(grep){
        args.push("--fixed-strings", `--grep=${grep}`)
        // A chave costuma vir em maiúsculas no commit, mas não se pode contar com isso.
        args.push("--regexp-ignore-case")
    }
    if(since)  args.push(`--since=${_iso(since)}`)
    if(until)  args.push(`--until=${_iso(until)}`)
    if(author) args.push(`--author=${author}`)
    if(Array.isArray(paths) && paths.length) args.push("--", ...paths)

    let stdout
    try { stdout = await RunGit(args, repositoryPath) }
    catch(e){ return [] }

    return stdout.split(RS)
        .map((registro) => registro.replace(/^\n/, ""))
        .filter((registro) => registro.trim().length)
        .map((registro) => {
            const [hash, shortHash, authorName, authorEmail, authorDate, subject, body] = registro.split(US)
            return {
                hash, shortHash, authorName, authorEmail,
                authorDate: authorDate || null,
                subject: subject || "",
                body: (body || "").trim()
            }
        })
}

const _iso = (v) => v instanceof Date ? v.toISOString() : String(v)

module.exports = GetRepositoryGitLog
