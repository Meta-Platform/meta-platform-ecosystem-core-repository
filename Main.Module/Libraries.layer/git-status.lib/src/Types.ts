/** As formas que a leitura de git desta lib produz. */

/** Rótulo simples do estado de um arquivo, derivado do porcelain. */
export type FileState = "untracked" | "conflicted" | "modified" | "staged"

export type DirtyFile = {
    path: string
    state: FileState
}

export type RepositoryStatus = {
    isRepo: boolean
    branch: string | null
    remote: string | null
    files: DirtyFile[]
}

/** Um nó de diretório no mapa de ancestrais: o que está sujo lá embaixo. */
export type AncestorStatus = {
    dirty: true
    count: number
    states: string[]
    /** Amostra — o nó não guarda a lista inteira, ver MAX_FILES_PER_NODE. */
    files: string[]
}

export type AncestorStatusMap = Record<string, AncestorStatus>

export type CommitSummary = {
    hash: string
    shortHash: string
    authorName: string
    authorEmail: string
    authorDate: string | null
    subject: string
    body: string
}

/** `added`/`deleted` nulos significam "não sei medir" (binário), não zero. */
export type CommitFile = {
    path: string
    status: string
    fromPath?: string
    added: number | null
    deleted: number | null
}

export type CommitDetail = CommitSummary & {
    files: CommitFile[]
    insertions: number
    deletions: number
}

/** Um repositório observado: o nome é do chamador, o caminho é o que a lib usa. */
export type WatchedRepository = {
    name: string
    path: string
}

/** O status já computado de um repositório, como fica no cache do gerenciador. */
export type ComputedStatus = RepositoryStatus & {
    dirty: boolean
    count: number
    statusByPath: AncestorStatusMap
}
