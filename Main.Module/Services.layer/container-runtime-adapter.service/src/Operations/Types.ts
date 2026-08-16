/*
    As formas compartilhadas pelos módulos de `src/Operations/`.

    O `dockerode` não publica declarações e este pacote não depende de
    `@types/dockerode`: o cliente e os objetos que ele devolve (container,
    imagem, rede, volume) entram como `any` DE PROPÓSITO. Escrever aqui uma
    cópia parcial da API do Docker daria aparência de garantia sem nenhuma — e
    o payload do daemon muda de forma entre versões e entre Docker e Podman,
    que é justamente o que este pacote existe para absorver.
*/

/** O cliente `dockerode` — ver acima. */
export type DockerClient = any

/** Handle de container, imagem, rede ou volume devolvido pelo cliente. */
export type DockerHandle = any

/** Payload cru do runtime: inspect, stats, evento, resultado de poda. */
export type DockerPayload = any

/**
    Filtros no vocabulário do Docker (status, label, name, dangling…). Chegam
    em mais de uma forma — string, lista, objeto — e quem normaliza é
    `Helpers/NormalizeDockerFilters`.
*/
export type DockerFilters = any

/**
    O que `Helpers/NormalizeDockerFilters` devolve, e a única forma que o
    daemon respeita: um mapa de LISTAS de string, ou o JSON já pronto de quem
    montou por conta própria. `undefined` quando não há filtro nenhum.
*/
export type NormalizedDockerFilters = string | Record<string, string[]> | undefined

/** `Helpers/NormalizeDockerFilters`, usado por listagem e por poda. */
export type NormalizeDockerFiltersFn = (filters?: DockerFilters) => NormalizedDockerFilters

/**
    O erro que estas operações lançam: um `Error` comum mais os campos que o
    pacote carimba — `code` para quem trata, `httpStatus`/`statusCode` para o
    webservice traduzir em resposta.
*/
export type OperationError = Error & {
    code?: string
    httpStatus?: number
    statusCode?: number
    field?: string
    errors?: any[]
    containers?: any[]
    containerId?: string
    containerName?: string
    logs?: string
    cause?: unknown
}

/** `Helpers/StreamToBuffer`, que chega pelo contexto. */
export type StreamToBufferFn = (
    stream: any,
    options?: { limiteEmBytes?: number | null, descricao?: string }
) => Promise<Buffer>

/** `Helpers/SafeFileName`, que chega pelo contexto. */
export type SafeFileNameFn = (value: unknown, fallback?: string) => string

/** O que `RunEphemeralAndCollect` colhe de um container efêmero. */
export type EphemeralResult = {
    statusCode: number
    stdout: string
    stderr: string
}

/** A fábrica de containers efêmeros sobre um volume, do mesmo contexto. */
export type EphemeralTools = {
    VOLUME_EXPORT_IMAGE: string
    EnsureVolumeExportImage: () => Promise<void>
    CreateEphemeralVolumeContainer: (options: {
        volumeName: string,
        cmd?: string[],
        readOnly?: boolean
    }) => Promise<DockerHandle>
    RunEphemeralAndCollect: (container: DockerHandle) => Promise<EphemeralResult>
    RemoveEphemeral: (container: DockerHandle) => Promise<void>
}

/** O resultado de um exec de uma tacada — ver `RunExec`, em Containers.ops. */
export type ExecResult = {
    exitCode: number | null
    stdout: string
    stderr: string
    timedOut: boolean
}

/**
    `RunExec` de Containers.ops, que Files.ops recebe pelo contexto: é a única
    dependência entre dois módulos de operações, e é deliberada.
*/
export type RunExecFn = (options: {
    containerIdOrName: string,
    cmd: string[],
    user?: string,
    workingDir?: string,
    env?: any,
    timeoutMs?: number
}) => Promise<ExecResult>

/**
    O contexto que o `Container.manager` monta uma vez e entrega a cada
    fábrica. Cada módulo declara abaixo só a parte que consome.
*/
export type OperationsContext = {
    docker: DockerClient
    StreamToBuffer: StreamToBufferFn
    SafeFileName: SafeFileNameFn
    ephemeral: EphemeralTools
}

export type ContainerOperationsContext =
    Pick<OperationsContext, "docker" | "StreamToBuffer" | "SafeFileName">

export type ImageOperationsContext =
    Pick<OperationsContext, "docker" | "StreamToBuffer" | "SafeFileName">

export type NetworkOperationsContext = Pick<OperationsContext, "docker">

export type SystemOperationsContext = Pick<OperationsContext, "docker">

export type VolumeOperationsContext =
    Pick<OperationsContext, "docker" | "SafeFileName" | "ephemeral">

export type FileOperationsContext =
    Pick<OperationsContext, "docker" | "StreamToBuffer" | "ephemeral">
    & { RunExec: RunExecFn }

/** Uma entrada de diretório, dentro de um volume ou de um container. */
export type DirectoryEntry = {
    name: string
    isDirectory: boolean
    size: number
    modifiedAt: string | null
    mode?: string | null
    owner?: string | null
}

/** Uma entrada lida de um TAR — ver `Helpers/TarSingleFile`. */
export type TarEntry = {
    name: string
    size: number
    isDirectory: boolean
    mode: number | null
    mtimeSeconds: number | null
    content?: Buffer
}

/**
    O que `Helpers/ResolveVolumeEntryPath` devolve. É uma união: só o ramo
    seguro tem caminho, e só o recusado tem motivo — nunca os dois.
*/
export type VolumeEntryPathResolution =
    | { safe: false, reason: string }
    | { safe: true, relative: string, absolute: string, isRoot: boolean }

/** A amostra de métricas já traduzida — ver `Helpers/NormalizeContainerStats`. */
export type NormalizedContainerStats = {
    readAt: string
    cpuPercent: number
    memoryUsage: number
    memoryLimit: number
    memoryPercent: number
    networkRx: number
    networkTx: number
    blockRead: number
    blockWrite: number
    pids: number
}

/* --------------------------------------------------------- ContainerSpec v1 */

/*
    O contrato de criação de container (CTMG-54). `Helpers/ContainerSpec`
    valida, `Helpers/BuildContainerCreateOptions` traduz para a API do runtime
    e `Helpers/DescribeContainerSpec` reconstrói a partir de um container que
    já existe — as três precisam da MESMA representação, que é a razão de o
    spec existir.

    Todo campo é opcional porque o formulário preenche o que quiser. As folhas
    onde mais de uma forma é aceita — montagem em quatro vocabulários, porta
    como número ou como texto, tamanho com sufixo — ficam largas DE PROPÓSITO:
    estreitá-las aqui faria a normalização que estes helpers prestam parecer
    supérflua, e ela é justamente o serviço.
*/

/** Uma porta do spec. `hostPort` ausente significa exposta, não publicada. */
export type ContainerPortSpec = {
    containerPort?: number | string
    hostPort?: number | string
    hostIp?: string
    protocol?: string
}

/**
    Uma montagem, em qualquer dos quatro vocabulários que
    `Helpers/NormalizeContainerCreateInput` aceita.
*/
export type ContainerMountSpec = {
    type?: string
    source?: string
    target?: string
    readOnly?: boolean
    sizeBytes?: number | string
    /* legado do orquestrador */
    volumeName?: string
    hostPath?: string
    /* vocabulário do Docker */
    Type?: string
    Source?: string
    Target?: string
    ReadOnly?: boolean
}

/**
    O healthcheck. O índice por texto existe porque a validação percorre
    `intervalSeconds`, `timeoutSeconds` e `startPeriodSeconds` num laço, pelo
    nome do campo.
*/
export type ContainerHealthcheckSpec = {
    disable?: boolean
    test?: string | string[]
    intervalSeconds?: number | string
    timeoutSeconds?: number | string
    startPeriodSeconds?: number | string
    retries?: number | string
    [campo: string]: unknown
}

/**
    Reinício. `maximumRetryCount` é `any` porque a validação o compara com
    `> 0` sem antes conferir se veio — e o que se está verificando ali é
    exatamente o caso em que ele veio junto da política errada.
*/
export type ContainerRestartSpec = {
    policy?: string
    maximumRetryCount?: any
}

/**
    Limites e reservas. Os tamanhos são `any` porque entram como número OU
    como texto com sufixo ("512m"), e a validação os percorre num laço junto
    com o nome do campo — `ParseByteSize` é quem resolve a forma.
*/
export type ContainerResourcesSpec = {
    memoryBytes?: any
    memoryReservationBytes?: any
    memorySwapBytes?: any
    cpus?: any
    nanoCpus?: number | string
    cpuShares?: number | string
    cpusetCpus?: string
    pidsLimit?: number | string
    blkioWeight?: number | string
    ulimits?: { name?: string, soft?: number | string, hard?: number | string }[]
    deviceRequests?: {
        driver?: string
        count?: number
        deviceIds?: string[]
        capabilities?: string[][]
    }[]
}

/** Um dispositivo do host. Sem destino, aparece no mesmo caminho de lá. */
export type ContainerDeviceSpec = {
    path?: string
    pathOnHost?: string
    pathInContainer?: string
    permissions?: string
}

/** Segurança. As listas chegam como texto ou como lista — daí `unknown`. */
export type ContainerSecuritySpec = {
    privileged?: boolean
    readonlyRootfs?: boolean
    noNewPrivileges?: boolean
    capAdd?: unknown
    capDrop?: unknown
    securityOpt?: unknown
    groupAdd?: unknown
}

export type ContainerSpec = {
    image?: string
    name?: string
    platform?: string

    command?: unknown
    entrypoint?: unknown
    workingDir?: string
    user?: string
    hostname?: string
    domainname?: string

    tty?: boolean
    openStdin?: boolean
    stdinOnce?: boolean
    stopSignal?: string
    stopTimeoutSeconds?: number | string

    labels?: Record<string, unknown>
    env?: Record<string, unknown>

    ports?: ContainerPortSpec[]
    publishAllPorts?: boolean
    mounts?: ContainerMountSpec[]
    volumesFrom?: unknown

    network?: {
        mode?: string
        aliases?: unknown
        ipv4Address?: string
        extraNetworks?: string[]
    }
    extraHosts?: unknown
    dns?: { servers?: unknown, search?: unknown, options?: unknown }

    restart?: ContainerRestartSpec
    autoRemove?: boolean
    init?: boolean
    healthcheck?: ContainerHealthcheckSpec
    resources?: ContainerResourcesSpec

    devices?: ContainerDeviceSpec[]
    security?: ContainerSecuritySpec
    sysctls?: Record<string, unknown>
    namespaces?: {
        ipcMode?: string
        pidMode?: string
        utsMode?: string
        shmSizeBytes?: number
    }
    logging?: { driver?: string, options?: Record<string, unknown> }
    runtime?: string

    /** Herdar os grupos do processo do adaptador — ver `ResolveGroupAdd`. */
    inheritHostGroups?: boolean
}

/**
    A forma ANTIGA de `CreateNewContainer`, que continua entrando: tem chamador
    em OUTRO REPOSITÓRIO (`ServiceOrchestrator.manager.js`, no VirtualDeskRepo).
    `Helpers/BuildContainerCreateOptions` a traduz para o spec canônico, e há
    teste de regressão com a chamada literal daquele arquivo.
*/
export type ContainerSpecInput = ContainerSpec & {
    imageName?: string
    containerName?: string
    networkmode?: string
    networkAliases?: unknown
    environment?: Record<string, unknown>
    groupAdd?: unknown
}

/**
    O que `ValidateContainerSpec` devolve. Ela DEVOLVE em vez de lançar porque
    um formulário com oito abas precisa marcar todos os campos errados de uma
    vez.
*/
export type ContainerSpecValidationError = {
    field: string
    code: string
    message: string
}

export type ContainerSpecValidation = {
    valid: boolean
    errors: ContainerSpecValidationError[]
}
