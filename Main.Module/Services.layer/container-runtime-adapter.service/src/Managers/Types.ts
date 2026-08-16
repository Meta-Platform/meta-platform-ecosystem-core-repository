/*
    Tipos compartilhados pelos módulos de gerência de conexão com runtimes de
    container (CTMG-8): o perfil persistido, o material de TLS que ele carrega,
    o que o resolvedor de endpoint devolve e o que a sondagem responde.
*/

/** Material de TLS de uma conexão remota — vai adiante como veio. */
export type TLSMaterial = {
    ca?: string
    cert?: string
    key?: string
}

/** O que o cliente do runtime recebe: socket unix OU host TCP. */
export type RuntimeClientOptions = {
    socketPath?: string
    host?: string
    port?: number
    protocol?: string
    ca?: string
    cert?: string
    key?: string
}

/**
    O retorno de `ResolveRuntimeConnection`. É uma união: só o ramo válido tem
    `clientOptions`, e só o inválido tem `reason`.
*/
export type RuntimeConnectionResolution =
    | { valid: false, reason: string }
    | {
        valid: true
        transport: "unix" | "tcp"
        socketPath?: string
        host?: string
        port?: number
        secure?: boolean
        clientOptions: RuntimeClientOptions
    }

/** Um perfil de conexão como fica no arquivo. */
export type ContainerConnection = {
    id: string
    name: string
    runtimeType: string
    endpoint: string
    transport: string
    createdAt: string
    updatedAt: string
    tls?: TLSMaterial
}

/** O mesmo perfil sem o material de TLS, que nunca sai em listagem. */
export type PublicContainerConnection = Omit<ContainerConnection, "tls"> & {
    hasTLS: boolean
}

/** Os campos que entram em cadastro e edição, antes de qualquer validação. */
export type ContainerConnectionInput = {
    name?: unknown
    runtimeType?: unknown
    endpoint?: unknown
    tls?: TLSMaterial
}

/** Uma sugestão de runtime encontrada no ambiente ou no disco. */
export type RuntimeSuggestion = {
    runtimeType: string
    suggestedName: string
    description: string
    endpoint: string
    source: string
}

/** A resposta da sondagem. Indisponibilidade é resposta, não exceção. */
export type ProbeResult = {
    reachable: boolean
    code?: string
    message?: string
    runtimeType?: string | null
    declaredRuntimeType?: string | null
    runtimeTypeMatches?: boolean | null
    version?: string | null
    apiVersion?: string | null
    os?: string | null
    arch?: string | null
}

/** O erro que este pacote lança carrega um `code` legível por quem chama. */
export type ErroComCodigo = Error & { code?: string }

/** O erro de operação recusada carrega também o nome da operação. */
export type ErroDeOperacao = ErroComCodigo & { operation?: string }

/** A superfície do armazenamento dos perfis. */
export type ContainerConnectionStorage = {
    Load: () => ContainerConnection[]
    Save: (connections: ContainerConnection[]) => ContainerConnection[]
    GetFilePath: () => string
}
