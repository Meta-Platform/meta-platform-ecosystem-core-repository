/** As formas do change set — do pedido cru ao normalizado que o escritor aplica. */

export type ChangeOperation = "put" | "delete" | "move"

/** Como o pedido chega: qualquer coisa, e é justamente por isso que é validado. */
export type RawChange = {
    op?: unknown
    path?: unknown
    newPath?: unknown
    content?: unknown
    contentBase64?: unknown
    mode?: unknown
    recursive?: unknown
    /**
     * `undefined` é ausência; `null` é AFIRMAÇÃO de que o arquivo ainda não
     * existe — é o que separa "criar novo" de "sobrescrever".
     */
    expectedOid?: string | null
}

export type NormalizedPut = {
    op: "put"
    path: string
    content: Buffer
    mode?: string
    expectedOid?: string | null
}

export type NormalizedDelete = {
    op: "delete"
    path: string
    recursive: boolean
    expectedOid?: string | null
}

export type NormalizedMove = {
    op: "move"
    path: string
    newPath: string
    expectedOid?: string | null
}

export type NormalizedChange = NormalizedPut | NormalizedDelete | NormalizedMove

export type ChangeLimits = {
    maxChanges: number
    maxFileBytes: number
    maxTotalBytes: number
    maxPathBytes: number
    maxMessageBytes: number
}

/** Um caminho e se ele vale para tudo abaixo dele. Ver `ChangeScopes`. */
export type ChangeScope = {
    path: string
    prefix: boolean
}

/** Uma entrada de `ls-tree`. */
export type TreeEntry = {
    mode: string
    type: string
    oid: string
    path: string
}

export type CommitInfo = {
    oid: string
    shortOid: string
    authorName: string
    authorEmail: string
    authoredAt: string
    subject: string
}

/** O que cada mudança de fato produziu — o relato, não o pedido. */
export type AppliedChange =
    | { op: "put", path: string, oid: string, mode: string }
    | { op: "delete", path: string, removed: number }
    | { op: "move", path: string, newPath: string, moved: number }

export type Identity = {
    name: string
    email: string
}

export type WriteCommitResult = {
    commit: CommitInfo
    ref: string
    branch: string
    previousHeadOid: string | null
    treeOid: string
    applied: AppliedChange[]
    /** Quantas vezes foi preciso reaplicar sobre uma ponta nova. */
    rebased: number
}
