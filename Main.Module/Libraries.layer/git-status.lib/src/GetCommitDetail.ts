import type { CommitDetail, CommitFile } from "./Types"

const RunGit = require("./RunGit") as (args: string[], cwd: string, options?: { timeoutMs?: number, maxBuffer?: number }) => Promise<string>

const US = "\x1f"
const HEADER = ["%H", "%h", "%an", "%ae", "%aI", "%s", "%b"].join(US)

/**
 * O DETALHE de um commit: quem, quando, o quê — e quais arquivos, com quanto
 * cresceu e quanto encolheu cada um.
 *
 * `--numstat` dá os números; `--name-status` dá a letra da operação (A/M/D/R).
 * São duas passadas de propósito: combinar os dois formatos numa só saída obriga
 * a um parse frágil, e o custo de um segundo `git show` é irrelevante perto de
 * errar a atribuição de um arquivo.
 *
 * Arquivo binário aparece com `-` no numstat; aqui vira `added: null,
 * deleted: null` em vez de zero — "não sei medir" e "não mudou nada" são coisas
 * diferentes.
 *
 * Nunca lança: hash inexistente resolve `null`.
 *
 */
const GetCommitDetail = async ({ repositoryPath, hash }: { repositoryPath?: string, hash?: string } = {}): Promise<CommitDetail | null> => {
    if(!hash) return null

    let cabecalho: string
    try { cabecalho = await RunGit(["show", "--no-patch", `--pretty=format:${HEADER}`, hash], repositoryPath!) }
    catch(e){ return null }

    const [h, shortHash, authorName, authorEmail, authorDate, subject, body] = cabecalho.split(US)

    const numeros = new Map<string, { added: number | null, deleted: number | null }>()
    try {
        const saida = await RunGit(["show", "--numstat", "--format=", hash], repositoryPath!)
        for(const linha of saida.split("\n")){
            if(!linha.trim()) continue
            const [added, deleted, caminho] = linha.split("\t")
            if(!caminho) continue
            numeros.set(caminho, {
                added:   added === "-" ? null : Number(added),
                deleted: deleted === "-" ? null : Number(deleted)
            })
        }
    } catch(e){ /* sem numstat: os arquivos ainda saem pelo name-status */ }

    const arquivos: CommitFile[] = []
    try {
        const saida = await RunGit(["show", "--name-status", "--format=", hash], repositoryPath!)
        for(const linha of saida.split("\n")){
            if(!linha.trim()) continue
            const partes = linha.split("\t")
            const status = partes[0]
            // Rename e copy trazem origem E destino; o caminho que interessa é o destino.
            const origem  = partes.length > 2 ? partes[1] : undefined
            const caminho = partes.length > 2 ? partes[2] : partes[1]
            if(!caminho) continue
            const n = numeros.get(caminho) || numeros.get(origem!) || {} as Partial<{ added: number | null, deleted: number | null }>
            arquivos.push({
                path: caminho,
                status: status[0],
                fromPath: origem,
                added: n.added !== undefined ? n.added : null,
                deleted: n.deleted !== undefined ? n.deleted : null
            })
        }
    } catch(e){ /* mantém a lista vazia */ }

    const soma = (campo: "added" | "deleted") => arquivos.reduce((total, a) => total + (typeof a[campo] === "number" ? a[campo]! : 0), 0)

    return {
        hash: h, shortHash, authorName, authorEmail,
        authorDate: authorDate || null,
        subject: subject || "",
        body: (body || "").trim(),
        files: arquivos,
        insertions: soma("added"),
        deletions: soma("deleted")
    }
}

module.exports = GetCommitDetail
