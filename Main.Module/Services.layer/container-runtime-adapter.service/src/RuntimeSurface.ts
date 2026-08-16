/*
    A superfície do runtime, declarada uma vez (CTMG-33).

    Este pacote publica DUAS implementações da mesma ideia: o
    `ContainerRuntimeAdapter`, que fala direto com o socket, e o
    `ContainerRuntimeClient`, que fala com o adaptador por unix socket. O README
    dizia que as duas tinham a mesma superfície. Não tinham: faltavam oito
    métodos no cliente, e nada no projeto impedia que o nono nascesse só de um
    lado — a divergência só aparecia quando um painel do Ring 1 chamava algo que
    não existia e recebia "undefined is not a function".

    Este arquivo é a fonte única, e `test/RuntimeSurfaceParity.test.js` falha
    quando a realidade se afasta dele. Operação nova entra aqui **junto** com a
    implementação, não depois.

    ## Os campos

    - `kind`
        - `call`    — pergunta e resposta; atravessa o socket sem problema
        - `stream`  — entrega contínua por callback
        - `session` — canal de mão dupla (entrada e saída ao vivo)
        - `local`   — estado do próprio adaptador, sem sentido remoto

    - `clientSupported` — se o `ContainerRuntimeClient` deve implementar.
    - `reason` — obrigatório quando `false`. Por que não cabe, em uma linha.

    ## Por que streams não atravessam

    O `CommandExecutor` faz uma chamada e devolve um valor. Um callback que
    dispara dez vezes por segundo não sobrevive a essa forma: seria preciso um
    canal persistente, que é justamente o que o `container-orchestrator.webservice`
    oferece por WebSocket, uma camada acima.
*/

type SurfaceKind = "call" | "stream" | "session" | "local"

type SurfaceEntry = {
    name: string
    kind: SurfaceKind
    clientSupported: boolean
    reason?: string
    legacy?: boolean
}

const MOTIVO_STREAM =
    "Entrega contínua por callback não atravessa o CommandExecutor, que é " +
    "pergunta e resposta. Use as rotas de stream do container-orchestrator.webservice."

const RUNTIME_SURFACE: SurfaceEntry[] = [
    // ---- containers
    { name: "ListAllContainers", kind: "call", clientSupported: true },
    { name: "CreateNewContainer", kind: "call", clientSupported: true },
    { name: "StartContainer", kind: "call", clientSupported: true },
    { name: "StopContainer", kind: "call", clientSupported: true },
    { name: "RestartContainer", kind: "call", clientSupported: true },
    { name: "KillContainer", kind: "call", clientSupported: true },
    { name: "PauseContainer", kind: "call", clientSupported: true },
    { name: "UnpauseContainer", kind: "call", clientSupported: true },
    { name: "RenameContainer", kind: "call", clientSupported: true },
    { name: "RemoveContainer", kind: "call", clientSupported: true },
    { name: "InspectContainer", kind: "call", clientSupported: true },
    { name: "GetContainerLogHistory", kind: "call", clientSupported: true },
    { name: "ExportContainer", kind: "call", clientSupported: true },
    // Exec de uma tacada (CTMG-42): pergunta e resposta, ao contrário do
    // OpenExecSession — por isso atravessa o socket sem problema.
    { name: "RunExec", kind: "call", clientSupported: true },
    { name: "GetContainerStatsSnapshot", kind: "call", clientSupported: true },
    { name: "WaitContainer", kind: "call", clientSupported: true },
    { name: "PruneContainers", kind: "call", clientSupported: true },
    { name: "CreateAndStartContainer", kind: "call", clientSupported: true },
    { name: "UpdateContainerResources", kind: "call", clientSupported: true },
    { name: "ListContainerProcesses", kind: "call", clientSupported: true },
    { name: "GetContainerFileSystemChanges", kind: "call", clientSupported: true },
    { name: "CommitContainer", kind: "call", clientSupported: true },
    // O spec de um container que existe, e a recriação a partir dele
    // (CTMG-56, 57) — base de editar, duplicar e atualizar com um clique.
    { name: "GetContainerSpec", kind: "call", clientSupported: true },
    { name: "RecreateContainer", kind: "call", clientSupported: true },

    // ---- imagens
    { name: "ListAllImages", kind: "call", clientSupported: true },
    { name: "InspectImage", kind: "call", clientSupported: true },
    { name: "RemoveImage", kind: "call", clientSupported: true },
    { name: "ExportImage", kind: "call", clientSupported: true },
    { name: "BuildImageFromDockerfileString", kind: "call", clientSupported: true },
    { name: "BuildImageFromDockerfileContent", kind: "call", clientSupported: true },
    { name: "PullImage", kind: "call", clientSupported: true },
    { name: "PushImage", kind: "call", clientSupported: true },
    { name: "TagImage", kind: "call", clientSupported: true },
    { name: "GetImageHistory", kind: "call", clientSupported: true },
    { name: "SearchImages", kind: "call", clientSupported: true },
    { name: "RegistryLogin", kind: "call", clientSupported: true },
    { name: "LoadImage", kind: "call", clientSupported: true },
    { name: "PruneImages", kind: "call", clientSupported: true },
    { name: "CheckImageUpdate", kind: "call", clientSupported: true },

    // ---- redes
    { name: "ListAllNetworks", kind: "call", clientSupported: true },
    { name: "InspectNetwork", kind: "call", clientSupported: true },
    { name: "CreateNewNetwork", kind: "call", clientSupported: true },
    { name: "RemoveNetwork", kind: "call", clientSupported: true },
    { name: "ConnectContainerToNetwork", kind: "call", clientSupported: true },
    { name: "DisconnectContainerFromNetwork", kind: "call", clientSupported: true },
    { name: "PruneNetworks", kind: "call", clientSupported: true },
    // Quem está conectado, com alias e stack (CTMG-102).
    { name: "GetNetworkUsage", kind: "call", clientSupported: true },

    // ---- volumes
    { name: "ListAllVolumes", kind: "call", clientSupported: true },
    { name: "InspectVolume", kind: "call", clientSupported: true },
    { name: "CreateNewVolume", kind: "call", clientSupported: true },
    { name: "RemoveVolume", kind: "call", clientSupported: true },
    { name: "PruneVolumes", kind: "call", clientSupported: true },
    { name: "ExportVolume", kind: "call", clientSupported: true },
    // Backup que restaura, clone e esvaziar (CTMG-98, 99) — as três recusam
    // volume em uso sem `force`. Mais o tamanho e quem depende (CTMG-100).
    { name: "ImportVolume", kind: "call", clientSupported: true },
    { name: "CloneVolume", kind: "call", clientSupported: true },
    { name: "EmptyVolume", kind: "call", clientSupported: true },
    { name: "GetVolumeUsage", kind: "call", clientSupported: true },

    // ---- sistema
    { name: "GetRuntimeInfo", kind: "call", clientSupported: true },
    { name: "GetRuntimeVersion", kind: "call", clientSupported: true },
    { name: "PingRuntime", kind: "call", clientSupported: true },
    { name: "GetDiskUsage", kind: "call", clientSupported: true },
    { name: "PruneSystem", kind: "call", clientSupported: true },

    // ---- arquivos dentro do volume
    { name: "ListVolumeEntries", kind: "call", clientSupported: true },
    { name: "PutFileInVolume", kind: "call", clientSupported: true },
    { name: "GetFileFromVolume", kind: "call", clientSupported: true },
    { name: "DeleteVolumeEntry", kind: "call", clientSupported: true },
    { name: "MakeVolumeDirectory", kind: "call", clientSupported: true },
    { name: "MoveVolumeEntry", kind: "call", clientSupported: true },
    { name: "PutFileChunkInVolume", kind: "call", clientSupported: true },
    { name: "GetFileChunkFromVolume", kind: "call", clientSupported: true },
    { name: "InspectVolumeUpload", kind: "call", clientSupported: true },

    // ---- arquivos dentro do container
    { name: "ListContainerEntries", kind: "call", clientSupported: true },
    { name: "CopyToContainer", kind: "call", clientSupported: true },
    { name: "CopyFromContainer", kind: "call", clientSupported: true },
    { name: "DeleteContainerEntry", kind: "call", clientSupported: true },
    { name: "MakeContainerDirectory", kind: "call", clientSupported: true },

    // ---- entrega contínua
    {
        name: "StreamContainerLogs",
        kind: "stream",
        clientSupported: false,
        reason: MOTIVO_STREAM
    },
    {
        name: "StreamContainerStats",
        kind: "stream",
        clientSupported: false,
        reason: MOTIVO_STREAM
    },
    {
        name: "OpenExecSession",
        kind: "session",
        clientSupported: false,
        reason:
            "Sessão de mão dupla: a entrada do usuário precisa chegar ao processo " +
            "enquanto a saída volta. Só existe no adaptador em processo."
    },
    {
        name: "StreamRuntimeEvents",
        kind: "stream",
        clientSupported: false,
        reason: MOTIVO_STREAM
    },
    {
        name: "RegisterDockerEventListener",
        kind: "stream",
        clientSupported: true,
        // O cliente o implementa apenas para lançar um erro explicativo: é
        // legado, e some quando StreamRuntimeEvents (CTMG-52) o substituir.
        legacy: true
    },

    // ---- estado do próprio adaptador
    {
        name: "GetEventStreamState",
        kind: "local",
        clientSupported: false,
        reason: "Estado interno do adaptador em processo; não descreve o runtime remoto."
    }
]

const SURFACE_BY_NAME = RUNTIME_SURFACE.reduce((mapa: Record<string, SurfaceEntry>, entrada) => {
    mapa[entrada.name] = entrada
    return mapa
}, {})

const CLIENT_SUPPORTED = RUNTIME_SURFACE
    .filter((entrada) => entrada.clientSupported)
    .map((entrada) => entrada.name)

const UNSUPPORTED_REASON = (name: string) => {
    const entrada = SURFACE_BY_NAME[name]
    return entrada && entrada.reason ? entrada.reason : "Operação indisponível por unix socket."
}

module.exports = {
    RUNTIME_SURFACE,
    SURFACE_BY_NAME,
    CLIENT_SUPPORTED,
    UNSUPPORTED_REASON
}
