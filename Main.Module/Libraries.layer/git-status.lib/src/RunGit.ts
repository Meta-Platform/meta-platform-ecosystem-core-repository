const { execFile } = require("child_process") as typeof import("child_process")

/**
 * Executa `git` num repositório e resolve o stdout (ou rejeita).
 *
 * Era privado ao GetRepositoryGitStatus. Passou a ser exportado quando a leitura
 * de HISTÓRICO entrou na lib: log e detalhe de commit precisam do mesmo runner —
 * com o mesmo buffer generoso (um `git log` de repositório grande passa fácil do
 * default de 1 MB) e agora com timeout, porque um `git` que trava num repo com
 * problema não pode segurar quem chamou para sempre.
 *
 */
const RunGit = (
    args: string[],
    cwd: string,
    { timeoutMs = 20000, maxBuffer = 64 * 1024 * 1024 }: { timeoutMs?: number, maxBuffer?: number } = {}
): Promise<string> =>
    new Promise((resolve, reject) => {
        execFile("git", args, { cwd, maxBuffer, timeout: timeoutMs }, (error, stdout) => {
            if(error) return reject(error)
            resolve(stdout)
        })
    })

module.exports = RunGit
