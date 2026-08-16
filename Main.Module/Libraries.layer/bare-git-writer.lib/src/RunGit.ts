const { execFile, spawn } = require("child_process") as typeof import("child_process")
const { promisify } = require("util") as typeof import("util")

const { GitRuntimeError } = require("./Errors") as { GitRuntimeError: new (message: string, options?: { stderr?: unknown, cause?: unknown }) => Error }

/** Opções comuns aos três runners. */
type RunOptions = {
    gitExecutable?: string
    env?: NodeJS.ProcessEnv
    encoding?: BufferEncoding | "buffer"
    timeoutMs?: number
    maxBuffer?: number
}

const ExecFile = promisify(execFile)

const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 60000

/*
    Runner de `git` para a escrita.

    Três diferenças em relação ao runner de leitura da `git-status.lib`, e cada
    uma existe por um motivo:

    1. NUNCA passa por shell (`execFile`, argumentos em array). Conteúdo e
       caminho vêm de quem usa a tela; um `sh -c` aqui seria injeção direta.

    2. Recebe `env` explícito. `commit-tree` só sabe quem é o autor pelas
       variáveis GIT_AUTHOR_ e GIT_COMMITTER_ ou por config — e num container sem
       `user.email` configurado ele FALHA com "Committer identity unknown". Ou
       seja: passar identidade por env não é refinamento, é requisito. O índice
       temporário chega pelo mesmo caminho (GIT_INDEX_FILE).

    3. Preserva o stderr na exceção. `hash-object`/`update-index`/`update-ref`
       falham por motivos específicos e acionáveis; engolir o stderr transforma
       todos eles em "o serviço Git não está disponível".
*/
const RunGit = async (args: string[], { gitExecutable = "git", env, encoding, timeoutMs = DEFAULT_TIMEOUT_MS, maxBuffer = DEFAULT_MAX_BUFFER }: RunOptions = {}): Promise<{ stdout: any, stderr: any }> => {
    try {
        return await ExecFile(gitExecutable, args, {
            env: env ?? process.env,
            timeout: timeoutMs,
            maxBuffer,
            ...(encoding ? { encoding } : {})
        })
    } catch (error: any) {
        const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : error?.stderr?.toString?.().trim()
        throw new GitRuntimeError(`Falha ao executar git ${args[0] ?? ""}.`.trim(), { stderr, cause: error })
    }
}

/*
    Variante para PERGUNTA, não para operação: "este ref existe?", "este caminho
    é um blob?". `RunGit` traduziria a resposta legítima "não" em
    indisponibilidade do serviço; esta devolve `undefined`.
*/
const TryRunGit = async (args: string[], options: RunOptions = {}) => {
    try {
        return await RunGit(args, options)
    } catch {
        return undefined
    }
}

/*
    Runner que ALIMENTA o git pela entrada padrão.

    Existe por uma limitação concreta: `git update-index` com lista de caminhos
    recusa rodar em repositório bare ("fatal: this operation must be run in a
    work tree"), porque pathspec pressupõe árvore de trabalho. A forma que
    funciona em bare é `update-index --index-info`, que lê as entradas de stdin —
    e de quebra faz adição e remoção da árvore inteira num processo só, em vez de
    um `update-index` por arquivo.

    `execFile` não sabe escrever em stdin (só a variante síncrona sabe), então
    aqui é `spawn` na mão.
*/
const RunGitWithInput = (args: string[], input: string, { gitExecutable = "git", env, timeoutMs = DEFAULT_TIMEOUT_MS }: RunOptions = {}): Promise<{ stdout: string, stderr: string }> =>
    new Promise((resolve, reject) => {
        const child = spawn(gitExecutable, args, { env: env ?? process.env })

        let stdout = ""
        let stderr = ""
        let settled = false

        const Settle = (Action: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            Action()
        }

        const timer = setTimeout(() => {
            child.kill("SIGKILL")
            Settle(() => reject(new GitRuntimeError(`git ${args[0] ?? ""} não respondeu no tempo esperado.`.trim())))
        }, timeoutMs)

        child.stdout!.on("data", (chunk) => { stdout += chunk })
        child.stderr!.on("data", (chunk) => { stderr += chunk })
        child.on("error", (error) => Settle(() => reject(
            new GitRuntimeError("Não foi possível executar o git.", { cause: error }))))
        child.on("close", (code) => Settle(() => code === 0
            ? resolve({ stdout, stderr })
            : reject(new GitRuntimeError(`Falha ao executar git ${args[0] ?? ""}.`.trim(), { stderr: stderr.trim() }))))

        // O git pode fechar stdin antes de nós terminarmos de escrever (erro na
        // primeira linha, por exemplo). O EPIPE resultante não é a falha — a
        // falha é o código de saída, que chega em `close`.
        child.stdin!.on("error", () => {})
        child.stdin!.end(input)
    })

module.exports = RunGit
module.exports.TryRunGit = TryRunGit
module.exports.RunGitWithInput = RunGitWithInput
