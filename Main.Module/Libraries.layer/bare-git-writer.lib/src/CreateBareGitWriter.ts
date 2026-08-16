import type {
    AppliedChange, ChangeLimits, CommitInfo, Identity, NormalizedChange,
    RawChange, TreeEntry, WriteCommitResult
} from "./Types"

const fs = require("fs") as typeof import("fs")
const { join } = require("path") as typeof import("path")
const { randomUUID } = require("crypto") as typeof import("crypto")

type GitResult = { stdout: any, stderr: any }
type GitOptions = { env?: NodeJS.ProcessEnv, timeoutMs?: number, maxBuffer?: number, encoding?: any }

const RunGit = require("./RunGit") as ((args: string[], options?: GitOptions & { gitExecutable?: string }) => Promise<GitResult>) & {
    TryRunGit: (args: string[], options?: GitOptions & { gitExecutable?: string }) => Promise<GitResult | undefined>
    RunGitWithInput: (args: string[], input: string, options?: GitOptions & { gitExecutable?: string }) => Promise<{ stdout: string, stderr: string }>
}
const { TryRunGit, RunGitWithInput } = RunGit
const NormalizeChangeSet = require("./NormalizeChangeSet") as ((changes: RawChange[], limits?: Partial<ChangeLimits>) => NormalizedChange[]) & {
    NormalizeMessage: (value: unknown, limits: ChangeLimits) => string
    IntersectsChangedPaths: (changes: NormalizedChange[], changedPaths: string[]) => string[]
    DEFAULT_LIMITS: ChangeLimits
}
const { NormalizeMessage, IntersectsChangedPaths, DEFAULT_LIMITS } = NormalizeChangeSet
const {
    InvalidChangeError,
    HeadAssertionRequiredError,
    StaleHeadError,
    FileChangedError,
    EmptyCommitError,
    GitRuntimeError
} = require("./Errors") as {
    InvalidChangeError: new (message: string, code?: string) => Error
    HeadAssertionRequiredError: new (currentHeadOid?: string) => Error
    StaleHeadError: new (options: { expectedHeadOid?: string | null, currentHeadOid?: string | null, conflictingPaths?: string[] }) => Error
    FileChangedError: new (conflicts: unknown) => Error
    EmptyCommitError: new (headOid?: string) => Error
    GitRuntimeError: new (message: string, options?: { stderr?: string, cause?: unknown }) => Error & { stderr?: string }
}

/*
    ESCRITA EM REPOSITÓRIO BARE, POR PLUMBING.

    Um repositório bare não tem árvore de trabalho: não existe arquivo para
    editar nem `git commit` para dar. O commit é MONTADO —
    `hash-object` grava o conteúdo, `update-index` monta a árvore num índice
    temporário, `write-tree` a materializa, `commit-tree` amarra ao pai e
    `update-ref` publica.

    POR QUE ASSIM, E NÃO COM UM WORKTREE TEMPORÁRIO

    O caminho óbvio seria `git worktree add` num diretório temporário, escrever
    os arquivos, `git commit`, apagar. Perde em três pontos, e o terceiro é o
    que decide:

      1. Custo — o worktree faz checkout do repositório INTEIRO para trocar uma
         linha. Aqui o custo é proporcional ao que mudou.
      2. Sujeira — container que morre no meio deixa worktree órfã e um lock que
         BLOQUEIA a tentativa seguinte. Aqui o que sobra é um índice num diretório
         temporário e, no pior caso, objetos soltos, que o `gc` varre.
      3. Atomicidade — `git commit` não tem compare-and-swap. `update-ref
         <ref> <novo> <antigo>` só publica se a ponta ainda for exatamente a que
         foi lida, e é isso que impede que duas abas (ou uma aba e um `git push`)
         se sobrescrevam em silêncio. É a garantia central desta lib, e o
         worktree simplesmente não a oferece.

    O QUE ESTA LIB NÃO FAZ

    Não sabe o que é usuário, dono, permissão ou banco de dados. Recebe o
    caminho de um git-dir e um change set. Quem chama decide se aquela pessoa
    podia pedir aquilo — e é justamente por isso que autorização não pode ser
    "esquecida aqui": nunca esteve aqui.
*/

const MAX_REBASE_ATTEMPTS = 3

const HEAD_OID_PATTERN = /^[0-9a-f]{40}$/i
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._/-]{0,254}$/

// Modo 0 com este oid é como `--index-info` diz "remova esta entrada".
const NULL_OID = "0000000000000000000000000000000000000000"

/*
    Assinaturas de perda de CAS do `update-ref`. Existem para não confundir
    "alguém commitou antes de você" (que é resposta, e tem tratamento) com "o
    git está quebrado" (que é indisponibilidade). Sem esta distinção, uma falha
    real de disco viraria três tentativas de rebase e um 409 enganoso.
*/
const CAS_FAILURE_PATTERN = /but expected|reference already exists|cannot lock ref|unable to update ref/i

const AssertBranchName = (value: unknown): string => {
    const branch = typeof value === "string" ? value.trim() : ""
    if (!BRANCH_NAME_PATTERN.test(branch) || branch.endsWith(".lock") || branch.includes("..")) {
        throw new InvalidChangeError("Nome de branch inválido.", "INVALID_BRANCH")
    }
    /*
        Esta lib recebe o nome CURTO e prefixa `refs/heads/` ela mesma. Aceitar
        "refs/heads/main" criaria, calado, um `refs/heads/refs/heads/main` — um
        branch que o usuário não pediu e que nenhuma tela mostra. É erro de quem
        chama, e vale dizer.
    */
    if (branch.startsWith("refs/")) {
        throw new InvalidChangeError("Informe o nome curto do branch, sem \"refs/\".", "INVALID_BRANCH")
    }
    return branch
}

const AssertHeadOid = (value: unknown): string | null | undefined => {
    if (value === undefined || value === null) return value
    if (typeof value !== "string" || !HEAD_OID_PATTERN.test(value)) {
        throw new InvalidChangeError("Identificador de commit inválido.", "INVALID_HEAD_OID")
    }
    return value.toLowerCase()
}

const ParseTreeEntries = (stdout: string): TreeEntry[] => stdout.split("\0").filter(Boolean).map((line): TreeEntry => {
    const tabIndex = line.indexOf("\t")
    const [mode, type, oid] = line.slice(0, tabIndex).split(/\s+/)
    return { mode, type, oid, path: line.slice(tabIndex + 1) }
})

const CreateBareGitWriter = ({ gitExecutable = "git", scratchRootPath, limits = {} }: {
    gitExecutable?: string
    scratchRootPath?: string
    limits?: Partial<ChangeLimits>
} = {}) => {

    if (typeof scratchRootPath !== "string" || scratchRootPath.trim() === "") {
        throw new Error("bare-git-writer.lib: informe scratchRootPath.")
    }
    const effectiveLimits = { ...DEFAULT_LIMITS, ...limits }

    const Git = (args: string[], options: GitOptions = {}) => RunGit(args, { gitExecutable, ...options })
    const TryGit = (args: string[], options: GitOptions = {}) => TryRunGit(args, { gitExecutable, ...options })
    const GitWithInput = (args: string[], input: string, options: GitOptions = {}) => RunGitWithInput(args, input, { gitExecutable, ...options })

    const InGitDir = (gitDirPath: string, args: string[]) => ["--git-dir", gitDirPath, ...args]

    /* ------------------------------------------------------------------ *
     *  Leitura de estado (o mínimo que a escrita precisa saber)
     * ------------------------------------------------------------------ */

    const ResolveBranchTip = async ({ gitDirPath, branch }: { gitDirPath: string, branch: string }): Promise<string | undefined> => {
        const result = await TryGit(InGitDir(gitDirPath, [
            "rev-parse", "--verify", "--quiet", `refs/heads/${AssertBranchName(branch)}`
        ]))
        const oid = result?.stdout?.trim()
        return oid ? oid.toLowerCase() : undefined
    }

    const ListBranches = async ({ gitDirPath }: { gitDirPath: string }) => {
        const result = await Git(InGitDir(gitDirPath, [
            "for-each-ref", "--format=%(refname:short)%09%(objectname)", "refs/heads"
        ]))
        return result.stdout.trim().split("\n").filter(Boolean).map((line: string) => {
            const [name, oid] = line.split("\t")
            return { name, oid }
        })
    }

    /*
        Entradas de árvore de um caminho. `-r` faz um caminho de arquivo devolver
        o próprio arquivo e um caminho de diretório devolver tudo abaixo dele —
        que é exatamente o que `move` e `delete` recursivo precisam, sem
        precisar perguntar antes qual dos dois é.
    */
    const ListPathEntries = async ({ gitDirPath, treeish, path, recursive = true }: {
        gitDirPath: string
        treeish?: string
        path: string
        recursive?: boolean
    }): Promise<TreeEntry[]> => {
        if (!treeish) return []
        const args = ["ls-tree", "-z"]
        if (recursive) args.push("-r")
        args.push(treeish, "--", path)
        const result = await TryGit(InGitDir(gitDirPath, args))
        return result ? ParseTreeEntries(result.stdout) : []
    }

    const ReadEntryAt = async ({ gitDirPath, treeish, path }: { gitDirPath: string, treeish?: string, path: string }) => {
        const entries = await ListPathEntries({ gitDirPath, treeish, path, recursive: false })
        return entries.find((entry) => entry.path === path)
    }

    const DiffPaths = async ({ gitDirPath, fromOid, toOid }: { gitDirPath: string, fromOid?: string, toOid?: string }): Promise<string[]> => {
        if (!fromOid) {
            const entries = await ListPathEntries({ gitDirPath, treeish: toOid, path: "", recursive: true })
            return entries.map(({ path }) => path)
        }
        const result = await Git(InGitDir(gitDirPath, [
            "diff-tree", "-r", "-z", "--name-only", "--no-commit-id", fromOid, toOid!
        ]))
        return result.stdout.split("\0").filter(Boolean)
    }

    /*
        RASCUNHO NO SERVIDOR — conteúdo guardado FORA da história.

        Um rascunho não é um commit: não tem mensagem, não tem pai, e não deve
        aparecer em `git log`. A forma nativa do git para isso é um blob solto
        apontado por um ref próprio em `refs/workspace-drafts/`, que:

          · não é branch nem tag, então nenhuma tela de histórico o mostra;
          · não é clonado por padrão (`git clone` traz refs/heads e refs/tags);
          · sobrevive ao gc, porque um ref é raiz de alcançabilidade — que é
            exatamente o que um blob solto sem ref NÃO teria.

        O ref guarda um blob (o JSON do rascunho), não uma árvore: o formato é
        assunto de quem chama, e a lib só precisa de um lugar durável.
    */
    const AssertDraftRef = (name: unknown): string => {
        const value = typeof name === "string" ? name.trim() : ""
        // Mesma validação de nome de ref, sem permitir escapar do namespace de
        // rascunhos: `..` ou barra inicial levaria a escrita para refs/heads.
        if (!BRANCH_NAME_PATTERN.test(value) || value.includes("..") || value.endsWith(".lock")) {
            throw new InvalidChangeError("Nome de rascunho inválido.", "INVALID_DRAFT")
        }
        return `refs/workspace-drafts/${value}`
    }

    const WriteDraft = async ({ gitDirPath, name, content, scratchPath }: {
        gitDirPath: string
        name: string
        content: string
        scratchPath?: string
    }) => {
        const ref = AssertDraftRef(name)
        const path = scratchPath ?? join(scratchRootPath!, randomUUID())
        await fs.promises.mkdir(path, { recursive: true })
        try {
            const temporaryPath = join(path, "draft")
            await fs.promises.writeFile(temporaryPath, content)
            const hashed = await Git(InGitDir(gitDirPath, ["hash-object", "-w", "--no-filters", "--", temporaryPath]))
            const oid = hashed.stdout.trim()
            // Sem compare-and-swap aqui de propósito: rascunho é do dono da
            // sessão e a última escrita é a que vale — a garantia de concorrência
            // pertence ao COMMIT, não ao rascunho.
            await Git(InGitDir(gitDirPath, ["update-ref", ref, oid]))
            return { ref, oid, bytes: Buffer.byteLength(content) }
        } finally {
            await fs.promises.rm(path, { recursive: true, force: true })
        }
    }

    const ReadDraft = async ({ gitDirPath, name }: { gitDirPath: string, name: string }) => {
        const ref = AssertDraftRef(name)
        const resolved = await TryGit(InGitDir(gitDirPath, ["rev-parse", "--verify", "--quiet", ref]))
        const oid = resolved?.stdout?.trim()
        if (!oid) return undefined
        const blob = await TryGit(InGitDir(gitDirPath, ["cat-file", "blob", oid]))
        if (!blob) return undefined
        return { ref, oid, content: blob.stdout }
    }

    const DeleteDraft = async ({ gitDirPath, name }: { gitDirPath: string, name: string }) => {
        const ref = AssertDraftRef(name)
        await TryGit(InGitDir(gitDirPath, ["update-ref", "-d", ref]))
        return { ref }
    }

    const CollectGarbage = ({ gitDirPath }: { gitDirPath: string }) =>
        TryGit(InGitDir(gitDirPath, ["gc", "--auto", "--quiet"]), { timeoutMs: 5 * 60 * 1000 })

    /* ------------------------------------------------------------------ *
     *  Montagem do commit
     * ------------------------------------------------------------------ */

    const HashContent = async ({ gitDirPath, scratchPath, content, index }: {
        gitDirPath: string
        scratchPath: string
        content: Buffer
        index: number
    }): Promise<string> => {
        const temporaryPath = join(scratchPath, `blob-${index}`)
        await fs.promises.writeFile(temporaryPath, content)
        /*
            `--no-filters` para que o que foi lido seja byte a byte o que fica
            gravado. Sem ele, `.gitattributes` do repositório poderia aplicar
            conversão de fim de linha ou `ident` sobre o conteúdo — e um editor
            que salva e relê veria um arquivo diferente do que escreveu.
        */
        const result = await Git(InGitDir(gitDirPath, ["hash-object", "-w", "--no-filters", "--", temporaryPath]))
        await fs.promises.rm(temporaryPath, { force: true })
        return result.stdout.trim()
    }

    /*
        Confere, mudança por mudança, se o arquivo ainda está como quem editou o
        viu. É mais fino que a checagem de ponta do branch: a ponta pode ter
        avançado sem que ESTE arquivo tenha mudado, e nesse caso não há conflito
        nenhum a relatar. `expectedOid: null` é a afirmação inversa — "eu estou
        criando, este arquivo não deveria existir" —, que é o que impede um
        "novo arquivo" de sobrescrever um homônimo criado no meio.
    */
    const AssertExpectedContent = async ({ gitDirPath, baseOid, changes }: {
        gitDirPath: string
        baseOid?: string
        changes: NormalizedChange[]
    }) => {
        const conflicts: unknown[] = []
        for (const change of changes) {
            if (change.expectedOid === undefined) continue
            const entry = await ReadEntryAt({ gitDirPath, treeish: baseOid, path: change.path })
            const currentOid = entry?.type === "blob" ? entry.oid : null
            if ((change.expectedOid ?? null) !== currentOid) {
                conflicts.push({ path: change.path, expectedOid: change.expectedOid, currentOid })
            }
        }
        if (conflicts.length > 0) throw new FileChangedError(conflicts)
    }

    const BuildTree = async ({ gitDirPath, scratchPath, baseOid, changes }: {
        gitDirPath: string
        scratchPath: string
        baseOid?: string
        changes: NormalizedChange[]
    }): Promise<{ treeOid: string, applied: AppliedChange[] }> => {
        const indexPath = join(scratchPath, "index")
        await fs.promises.rm(indexPath, { force: true })
        const env = { ...process.env, GIT_INDEX_FILE: indexPath }

        if (baseOid) await Git(InGitDir(gitDirPath, ["read-tree", baseOid]), { env })

        const removals: string[] = []
        const additions: string[] = []
        const applied: AppliedChange[] = []

        for (const [index, change] of changes.entries()) {
            if (change.op === "put") {
                const existing = await ReadEntryAt({ gitDirPath, treeish: baseOid, path: change.path })
                /*
                    Modo herdado quando o chamador não diz nada: editar um script
                    já marcado como executável não pode tirar o bit dele. Quem
                    quiser mudar o modo manda `mode` explícito.
                */
                const mode = change.mode
                    ?? (existing?.type === "blob" && existing.mode === "100755" ? "100755" : "100644")
                const oid = await HashContent({ gitDirPath, scratchPath, content: change.content, index })
                additions.push(`${mode} ${oid}\t${change.path}`)
                applied.push({ op: "put", path: change.path, oid, mode })
                continue
            }

            const entries = await ListPathEntries({ gitDirPath, treeish: baseOid, path: change.path })

            if (change.op === "delete") {
                if (entries.length === 0) {
                    // Já não existe. Não é erro: duas abas podem ter apagado o
                    // mesmo arquivo, e o commit vazio (se for a única mudança)
                    // é quem reporta que nada aconteceu.
                    applied.push({ op: "delete", path: change.path, removed: 0 })
                    continue
                }
                const isDirectory = !entries.some((entry) => entry.path === change.path)
                if (isDirectory && !change.recursive) {
                    throw new InvalidChangeError(
                        `"${change.path}" é um diretório: mande recursive para apagar o conteúdo.`,
                        "RECURSIVE_REQUIRED")
                }
                removals.push(...entries.map(({ path }) => path))
                applied.push({ op: "delete", path: change.path, removed: entries.length })
                continue
            }

            if (entries.length === 0) {
                throw new InvalidChangeError(`"${change.path}" não existe neste branch.`, "SOURCE_NOT_FOUND")
            }
            for (const entry of entries) {
                const suffix = entry.path.slice(change.path.length)
                additions.push(`${entry.mode} ${entry.oid}\t${change.newPath}${suffix}`)
                removals.push(entry.path)
            }
            applied.push({ op: "move", path: change.path, newPath: change.newPath, moved: entries.length })
        }

        /*
            UM `update-index --index-info` para o lote inteiro.

            Duas razões, e a primeira é impeditiva:

              1. `update-index` com lista de CAMINHOS (`--force-remove -- a b`)
                 recusa rodar em repositório bare: pathspec pressupõe árvore de
                 trabalho. `--index-info` lê de stdin e não tem esse pressuposto —
                 é a única forma de REMOVER uma entrada aqui.
              2. Um processo em vez de um por arquivo. Um scaffold de pacote
                 escreve meia dúzia de arquivos; um commit grande, centenas.

            Formato: `<modo> SP <oid> TAB <caminho>`, e modo `0` com oid nulo
            REMOVE a entrada. Remoções primeiro para que a troca de um arquivo por
            um diretório de mesmo nome (e o contrário) seja aplicada na ordem
            certa dentro do mesmo lote.

            O caminho vai depois de um TAB, então nome com TAB ou quebra de linha
            corromperia o lote — os dois já foram recusados na normalização, que é
            onde essa garantia tem que estar.
        */
        const indexInfo = [
            ...removals.map((path) => `0 ${NULL_OID}\t${path}`),
            ...additions
        ]
        if (indexInfo.length > 0) {
            await GitWithInput(InGitDir(gitDirPath, ["update-index", "--index-info"]),
                `${indexInfo.join("\n")}\n`, { env })
        }

        const treeResult = await Git(InGitDir(gitDirPath, ["write-tree"]), { env })
        return { treeOid: treeResult.stdout.trim(), applied }
    }

    const CommitTree = async ({ gitDirPath, scratchPath, treeOid, baseOid, message, author, committer }: {
        gitDirPath: string
        scratchPath: string
        treeOid: string
        baseOid?: string
        message: string
        author: Identity
        committer: Identity
    }): Promise<string> => {
        const messagePath = join(scratchPath, "message")
        /*
            Mensagem por ARQUIVO, nunca por argumento. Assunto com aspas, acento,
            quebra de linha ou um `-` inicial é normal numa mensagem de commit e
            estouraria (ou seria lido como opção) na linha de comando.
        */
        await fs.promises.writeFile(messagePath, `${message}\n`, "utf8")

        const args = ["commit-tree", treeOid]
        if (baseOid) args.push("-p", baseOid)
        args.push("-F", messagePath)

        const result = await Git(InGitDir(gitDirPath, args), {
            env: {
                ...process.env,
                GIT_AUTHOR_NAME    : author.name,
                GIT_AUTHOR_EMAIL   : author.email,
                GIT_COMMITTER_NAME : committer.name,
                GIT_COMMITTER_EMAIL: committer.email
            }
        })
        return result.stdout.trim()
    }

    const PublishRef = async ({ gitDirPath, branch, commitOid, baseOid }: {
        gitDirPath: string
        branch: string
        commitOid: string
        baseOid?: string
    }): Promise<boolean> => {
        try {
            // O terceiro argumento é o compare-and-swap. Vazio afirma "este ref
            // não deve existir ainda", que é o primeiro commit do repositório.
            await Git(InGitDir(gitDirPath, ["update-ref", `refs/heads/${branch}`, commitOid, baseOid ?? ""]))
            return true
        } catch (error) {
            if (error instanceof GitRuntimeError && CAS_FAILURE_PATTERN.test(error.stderr ?? "")) return false
            throw error
        }
    }

    const ReadCommit = async ({ gitDirPath, commitOid }: { gitDirPath: string, commitOid: string }): Promise<CommitInfo> => {
        const result = await Git(InGitDir(gitDirPath, [
            "log", "-1", "--date=iso-strict", "--format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s", commitOid
        ]))
        const [oid, shortOid, authorName, authorEmail, authoredAt, subject] = result.stdout.trim().split("\x1f")
        return { oid, shortOid, authorName, authorEmail, authoredAt, subject } as CommitInfo
    }

    /* ------------------------------------------------------------------ *
     *  WriteCommit
     * ------------------------------------------------------------------ */

    const WriteCommit = async ({
        gitDirPath,
        branch = "main",
        message,
        changes,
        expectedHeadOid,
        author,
        committer,
        onStale = "retryIfDisjoint",
        allowEmpty = false,
        requireHeadAssertion = true
    }: {
        gitDirPath: string
        branch?: string
        message?: unknown
        changes: RawChange[]
        expectedHeadOid?: string | null
        author?: Identity
        committer?: Identity
        onStale?: "retryIfDisjoint" | "reject"
        allowEmpty?: boolean
        requireHeadAssertion?: boolean
    }): Promise<WriteCommitResult> => {

        const safeBranch = AssertBranchName(branch)
        const safeMessage = NormalizeMessage(message, effectiveLimits)
        const normalizedChanges = NormalizeChangeSet(changes, effectiveLimits)
        const expected = AssertHeadOid(expectedHeadOid)

        if (!author?.name || !author?.email) {
            throw new InvalidChangeError("Informe nome e e-mail do autor do commit.", "INVALID_AUTHOR")
        }
        const effectiveCommitter = committer?.name && committer?.email ? committer : author

        /*
            Reconcilia o que o chamador esperava com o que o branch é agora.
            Devolve a base sobre a qual seguir, ou recusa. É chamada duas vezes:
            antes de montar nada (para não gastar objetos à toa) e depois de uma
            perda de CAS (a corrida real, na janela entre ler e publicar).
        */
        const Reconcile = async ({ expectedOid, actualOid }: { expectedOid?: string, actualOid?: string }): Promise<string | undefined> => {
            if (expectedOid === actualOid) return actualOid

            const changedPaths = await DiffPaths({ gitDirPath, fromOid: expectedOid, toOid: actualOid })
            const conflictingPaths = IntersectsChangedPaths(normalizedChanges, changedPaths)

            if (onStale === "reject" || conflictingPaths.length > 0) {
                throw new StaleHeadError({ expectedHeadOid: expectedOid, currentHeadOid: actualOid, conflictingPaths })
            }
            /*
                Ninguém tocou nos arquivos deste change set: reaplicar sobre a
                ponta nova é o mesmo commit, e mandar o usuário "recarregar e
                tentar de novo" seria burocracia por nada. É o rebase que o
                plumbing torna barato — e que o worktree não tornaria.
            */
            return actualOid
        }

        const scratchPath = join(scratchRootPath!, randomUUID())
        await fs.promises.mkdir(scratchPath, { recursive: true })

        try {
            let baseOid = await ResolveBranchTip({ gitDirPath, branch: safeBranch })

            if (requireHeadAssertion && baseOid && expected === undefined) {
                throw new HeadAssertionRequiredError(baseOid)
            }
            if (expected !== undefined) {
                baseOid = await Reconcile({ expectedOid: expected ?? undefined, actualOid: baseOid })
            }

            for (let attempt = 0; attempt <= MAX_REBASE_ATTEMPTS; attempt++) {
                await AssertExpectedContent({ gitDirPath, baseOid, changes: normalizedChanges })

                const { treeOid, applied } = await BuildTree({ gitDirPath, scratchPath, baseOid, changes: normalizedChanges })

                if (baseOid && !allowEmpty) {
                    const baseTree = await Git(InGitDir(gitDirPath, ["rev-parse", `${baseOid}^{tree}`]))
                    if (baseTree.stdout.trim() === treeOid) throw new EmptyCommitError(baseOid)
                }

                const commitOid = await CommitTree({
                    gitDirPath, scratchPath, treeOid, baseOid,
                    message: safeMessage, author: author!, committer: effectiveCommitter!
                })

                if (await PublishRef({ gitDirPath, branch: safeBranch, commitOid, baseOid })) {
                    return {
                        commit: await ReadCommit({ gitDirPath, commitOid }),
                        ref: `refs/heads/${safeBranch}`,
                        branch: safeBranch,
                        previousHeadOid: baseOid ?? null,
                        treeOid,
                        applied,
                        rebased: attempt
                    }
                }

                const actualOid = await ResolveBranchTip({ gitDirPath, branch: safeBranch })
                baseOid = await Reconcile({ expectedOid: baseOid, actualOid })
            }

            throw new StaleHeadError({
                expectedHeadOid: expected ?? null,
                currentHeadOid: await ResolveBranchTip({ gitDirPath, branch: safeBranch }),
                conflictingPaths: []
            })
        } finally {
            // O scratch some sempre. É a diferença entre "objeto solto que o gc
            // varre" e "lock que trava a próxima tentativa".
            await fs.promises.rm(scratchPath, { recursive: true, force: true })
        }
    }

    /* ------------------------------------------------------------------ *
     *  Branches
     * ------------------------------------------------------------------ */

    const CreateBranch = async ({ gitDirPath, name, fromRef }: { gitDirPath: string, name: string, fromRef?: string }) => {
        const branch = AssertBranchName(name)
        const source = fromRef ? AssertBranchName(fromRef) : undefined
        const sourceOid = source
            ? await ResolveBranchTip({ gitDirPath, branch: source })
            : undefined

        if (source && !sourceOid) throw new InvalidChangeError(`O branch "${source}" não existe.`, "SOURCE_NOT_FOUND")
        if (!sourceOid) throw new InvalidChangeError("Informe um branch de origem com commits.", "SOURCE_NOT_FOUND")

        if (!await PublishRef({ gitDirPath, branch, commitOid: sourceOid, baseOid: undefined })) {
            throw new InvalidChangeError(`O branch "${branch}" já existe.`, "BRANCH_EXISTS")
        }
        return { branch, oid: sourceOid }
    }

    const DeleteBranch = async ({ gitDirPath, name, expectedOid }: { gitDirPath: string, name: string, expectedOid?: string }) => {
        const branch = AssertBranchName(name)
        const expected = AssertHeadOid(expectedOid)
        const tip = await ResolveBranchTip({ gitDirPath, branch })
        if (!tip) throw new InvalidChangeError(`O branch "${branch}" não existe.`, "SOURCE_NOT_FOUND")
        if (expected && expected !== tip) {
            throw new StaleHeadError({ expectedHeadOid: expected, currentHeadOid: tip, conflictingPaths: [] })
        }
        // `-d <oldvalue>` também é compare-and-swap: não apaga se a ponta mudou.
        await Git(InGitDir(gitDirPath, ["update-ref", "-d", `refs/heads/${branch}`, tip]))
        return { branch, deletedOid: tip }
    }

    return Object.freeze({
        WriteCommit,
        WriteDraft,
        ReadDraft,
        DeleteDraft,
        ResolveBranchTip,
        ListBranches,
        CreateBranch,
        DeleteBranch,
        DiffPaths,
        CollectGarbage
    })
}

module.exports = CreateBareGitWriter
