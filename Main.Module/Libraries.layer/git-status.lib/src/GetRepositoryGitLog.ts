import type { CommitSummary } from "./Types"

const RunGit = require("./RunGit") as (args: string[], cwd: string, options?: { timeoutMs?: number, maxBuffer?: number }) => Promise<string>

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
 * `since`/`until` aceitam Date ou string ISO; `paths` limita a commits que
 * tocaram aqueles caminhos; `maxCount` é o teto de commits.
 */
const GetRepositoryGitLog = async ({
    repositoryPath, grep, since, until, author, paths, maxCount = 200
}: {
    repositoryPath?: string
    grep?: string
    since?: Date | string
    until?: Date | string
    author?: string
    paths?: string[]
    maxCount?: number
} = {}): Promise<CommitSummary[]> => {
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

    let stdout: string
    try { stdout = await RunGit(args, repositoryPath!) }
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

const _iso = (v: Date | string) => v instanceof Date ? v.toISOString() : String(v)

module.exports = GetRepositoryGitLog
