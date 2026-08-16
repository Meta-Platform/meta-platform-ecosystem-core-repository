import type { AncestorStatusMap, ComputedStatus, DirtyFile, RepositoryStatus, WatchedRepository } from "./Types"

const path     = require("path") as typeof import("path")
const chokidar = require("chokidar") as any

const GetRepositoryGitStatus = require("./GetRepositoryGitStatus") as (repositoryPath: string) => Promise<RepositoryStatus>
const BuildAncestorStatusMap = require("./BuildAncestorStatusMap") as (repositoryPath: string, files: DirtyFile[]) => AncestorStatusMap

const SEP = path.sep
const DEBOUNCE_MS = 300

// Não observamos node_modules (ruído + estoura o limite de inotify) nem o
// interior do .git — EXCETO index, HEAD e refs, que mudam em commit/checkout/
// branch (feitos por fora da IDE) e precisam refletir na árvore.
const IsIgnored = (fullPath: string): boolean => {
    if(fullPath.includes(`${SEP}node_modules${SEP}`) || fullPath.endsWith(`${SEP}node_modules`)) return true
    if(fullPath.endsWith(`${SEP}.git`)) return false   // permite descer no .git
    const marker = `${SEP}.git${SEP}`
    const idx = fullPath.indexOf(marker)
    if(idx !== -1){
        const rest = fullPath.slice(idx + marker.length)
        if(rest === "index" || rest === "HEAD")            return false
        if(rest === "refs" || rest.startsWith(`refs${SEP}`)) return false
        return true   // ignora objects, logs, packed-refs, etc.
    }
    return false
}

/**
 * Gerenciador de status git reativo, compartilhável entre apps.
 *
 * Mantém, por repositório, um watcher de filesystem (chokidar) com debounce e um
 * cache do status. Consumidores criam uma ASSINATURA sobre uma lista de repos e
 * recebem um callback a cada mudança em disco; o watcher de um repo vive
 * enquanto houver ao menos uma assinatura ativa (refcount).
 *
 * O gerenciador opera só sobre CAMINHOS — quem resolve nome->caminho é o
 * chamador (controller), mantendo esta lib genérica.
 */
const InitializeGitStatusManager = () => {

    type RepoEntry = {
        watcher: any
        refCount: number
        listeners: Set<() => void>
        cache: ComputedStatus | null
        timer: NodeJS.Timeout | null
    }

    const repos = new Map<string, RepoEntry>()

    const _ensureWatcher = (repoPath: string): RepoEntry => {
        const existing = repos.get(repoPath)
        if(existing){ existing.refCount++; return existing }

        const entry: RepoEntry = { watcher: null, refCount: 1, listeners: new Set(), cache: null, timer: null }
        repos.set(repoPath, entry)

        try {
            entry.watcher = chokidar.watch(repoPath, {
                ignored: IsIgnored,
                ignoreInitial: true,
                persistent: true,
                awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
            })
            const onFsEvent = () => {
                if(entry.timer) clearTimeout(entry.timer)
                entry.timer = setTimeout(() => {
                    entry.cache = null   // invalida — será recomputado sob demanda
                    entry.listeners.forEach((fn) => { try { fn() } catch(e){} })
                }, DEBOUNCE_MS)
            }
            entry.watcher.on("all", onFsEvent)
            entry.watcher.on("error", () => {})   // watcher falho não derruba o status (snapshot ainda funciona)
        } catch(e) { /* segue sem watcher */ }

        return entry
    }

    const _release = (repoPath: string) => {
        const entry = repos.get(repoPath)
        if(!entry) return
        entry.refCount--
        if(entry.refCount > 0) return
        if(entry.timer) clearTimeout(entry.timer)
        if(entry.watcher){ try { entry.watcher.close() } catch(e){} }
        repos.delete(repoPath)
    }

    const _compute = async (repoPath: string): Promise<ComputedStatus> => {
        const entry = repos.get(repoPath)
        if(entry && entry.cache) return entry.cache
        const { isRepo, branch, remote, files } = await GetRepositoryGitStatus(repoPath)
        const result = {
            isRepo,
            branch,
            remote,
            dirty: files.length > 0,
            count: files.length,
            // Lista completa (path + estado) para quem precisa mostrar O QUE mudou,
            // não só quantos: o mapa por caminho carrega apenas uma amostra por nó.
            files,
            statusByPath: isRepo ? BuildAncestorStatusMap(repoPath, files) : {}
        }
        if(entry) entry.cache = result
        return result
    }

    /**
     * Cria uma assinatura sobre uma lista de repositórios. `onChange` é chamado
     * (com debounce) quando qualquer um deles muda em disco.
     */
    const Subscribe = (repoList: WatchedRepository[], onChange: () => void) => {
        const list: WatchedRepository[] = []
        const seen: Record<string, true> = {}
        for(const repo of (repoList || [])){
            if(repo && repo.path && !seen[repo.path]){ seen[repo.path] = true; list.push(repo) }
        }

        list.forEach((repo) => {
            const entry = _ensureWatcher(repo.path)
            entry.listeners.add(onChange)
        })

        // Estado completo (não deltas) dos repos assinados: mapa por caminho
        // (para os nós da árvore) + resumo por nome (para o painel de repositórios).
        const GetStatus = async () => {
            const statusByPath: AncestorStatusMap = {}
            const repositories: Record<string, unknown> = {}
            for(const { name, path: repoPath } of list){
                const r = await _compute(repoPath)
                Object.assign(statusByPath, r.statusByPath)
                repositories[name] = {
                    path: repoPath, isRepo: r.isRepo, branch: r.branch, remote: r.remote,
                    dirty: r.dirty, count: r.count, files: r.files
                }
            }
            return { statusByPath, repositories }
        }

        const dispose = () => {
            list.forEach((repo) => {
                const entry = repos.get(repo.path)
                if(entry) entry.listeners.delete(onChange)
                _release(repo.path)
            })
        }

        return { GetStatus, dispose }
    }

    return { Subscribe }
}

module.exports = InitializeGitStatusManager
