const fs = require("fs")
const os = require("os")
const { join } = require("path")
const { execFileSync } = require("child_process")

const CreateBareGitWriter = require("../src/CreateBareGitWriter")

/*
    Os testes usam repositórios bare DE VERDADE em diretório temporário, não
    dublês. O que está sendo testado aqui é a interação com o `git` — um mock de
    `execFile` provaria apenas que os argumentos que escrevemos são os que
    escrevemos, e é justamente a leitura que o git faz deles que pode nos
    surpreender (o `--cacheinfo` com vírgula no caminho é o exemplo).
*/

const CreateTemporaryRoot = () => fs.mkdtempSync(join(os.tmpdir(), "bare-git-writer-"))

const CreateBareRepository = (rootPath, name = "repo") => {
    const gitDirPath = join(rootPath, `${name}.git`)
    execFileSync("git", ["init", "--bare", "--initial-branch=main", gitDirPath], { stdio: "pipe" })
    execFileSync("git", ["--git-dir", gitDirPath, "config", "receive.denyNonFastForwards", "true"], { stdio: "pipe" })
    return gitDirPath
}

const CreateWriter = (rootPath) => CreateBareGitWriter({
    scratchRootPath: join(rootPath, "scratch")
})

const AUTHOR = { name: "Kaio Cezar", email: "kadisk.shark@gmail.com" }

const Git = (gitDirPath, args) =>
    execFileSync("git", ["--git-dir", gitDirPath, ...args], { encoding: "utf8" }).trim()

const GitBuffer = (gitDirPath, args) =>
    execFileSync("git", ["--git-dir", gitDirPath, ...args], { maxBuffer: 64 * 1024 * 1024 })

/*
    `-z` não é detalhe de conveniência: SEM ele, `ls-tree --name-only` devolve
    caminho não-ASCII CITADO e com escape octal (`"docs/a\303\247\303\243o.md"`),
    porque `core.quotePath` é ligado por padrão. O arquivo está gravado certo — é
    a saída que vem embrulhada. Ler assim faria este teste comparar o nome
    escapado com o nome real e acusar falha onde não há, e faria qualquer código
    de produção que listasse arquivos mostrar lixo para quem usa acento.
*/
const ListTree = (gitDirPath, ref = "main") =>
    GitBuffer(gitDirPath, ["ls-tree", "-r", "-z", "--name-only", ref])
        .toString("utf8").split("\0").filter(Boolean)

const ReadBlob = (gitDirPath, path, ref = "main") =>
    GitBuffer(gitDirPath, ["cat-file", "blob", `${ref}:${path}`])

const Put = (path, text, extra = {}) => ({ op: "put", path, content: text, ...extra })

/*
    Simula o que um `git push` de fora faz: mexe na ponta do branch sem passar
    por esta lib. É como se produz a corrida que o compare-and-swap tem que
    pegar.
*/
const CommitFromOutside = (gitDirPath, files, message = "commit externo") => {
    const workPath = fs.mkdtempSync(join(os.tmpdir(), "bare-git-writer-clone-"))
    const env = {
        ...process.env,
        GIT_AUTHOR_NAME: "Outra Pessoa", GIT_AUTHOR_EMAIL: "outra@exemplo.local",
        GIT_COMMITTER_NAME: "Outra Pessoa", GIT_COMMITTER_EMAIL: "outra@exemplo.local"
    }
    execFileSync("git", ["clone", gitDirPath, workPath], { stdio: "pipe", env })
    for (const [path, text] of Object.entries(files)) {
        fs.mkdirSync(join(workPath, path, ".."), { recursive: true })
        fs.writeFileSync(join(workPath, path), text)
    }
    execFileSync("git", ["-C", workPath, "add", "--all"], { stdio: "pipe", env })
    execFileSync("git", ["-C", workPath, "commit", "-m", message], { stdio: "pipe", env })
    execFileSync("git", ["-C", workPath, "push", "origin", "HEAD:main"], { stdio: "pipe", env })
    fs.rmSync(workPath, { recursive: true, force: true })
    return Git(gitDirPath, ["rev-parse", "refs/heads/main"])
}

module.exports = {
    AUTHOR,
    CreateTemporaryRoot,
    CreateBareRepository,
    CreateWriter,
    Git,
    GitBuffer,
    ListTree,
    ReadBlob,
    Put,
    CommitFromOutside
}
