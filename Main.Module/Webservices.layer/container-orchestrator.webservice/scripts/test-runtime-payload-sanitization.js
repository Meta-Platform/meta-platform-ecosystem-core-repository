/*
    Teste da sanitização das respostas do container runtime (VDRP-194) —
    FIXTURES ISOLADAS. Nenhum container real é tocado: o adapter é substituído
    por um duplo que devolve um inspect realista carregado de segredos.

    Cobre:
    - valores mascarados por nome: password, secret, token, key, credential,
      authorization (os seis pedidos) e variantes
    - variável inofensiva preservada (a máscara não pode cegar o operador)
    - caminhos do host removidos: LogPath, ResolvConfPath, HostnamePath,
      HostsPath, Mountpoint, GraphDriver (Upper/Lower/Merged/Work)
    - `Source` de bind-mount redigido, `Destination` preservado
    - PID do host removido
    - Labels e Options de volume com credencial mascaradas
    - imagem: Config.Env e ContainerConfig.Env
    - varredura profunda: nenhum segredo e nenhum caminho de host sobra em
      qualquer ponto do JSON, em qualquer profundidade
    - o controller REAL do BFF sanitiza toda leitura (e não sanitiza log/export,
      que têm tratamento próprio)

    Uso:  node scripts/test-runtime-payload-sanitization.js
*/
const RequireSource = require("./RequireSource")

const SanitizeContainerRuntimePayload = RequireSource("Helpers/SanitizeContainerRuntimePayload")
const { REDACTED } = SanitizeContainerRuntimePayload
const ContainerOrchestratorController = RequireSource("Controllers/ContainerOrchestrator.controller")

let failures = 0
const ok = (cond, msg) => {
    console.log(`${cond ? "  OK   " : "  FALHA"} ${msg}`)
    if (!cond) failures++
}

// Segredos e caminhos distintos, para a varredura profunda ser conclusiva.
const SEGREDOS = [
    "s3nh4-do-postgres",
    "ghp_TOKEN_DO_GITHUB_123",
    "AKIA_CHAVE_SECRETA_AWS",
    "Bearer eyJhbGciOi-token-jwt",
    "credencial-do-driver-nfs",
    "cookie-de-sessao-abc"
]
const CAMINHOS_HOST = [
    "/var/lib/docker/containers/abc123/abc123-json.log",
    "/var/lib/docker/containers/abc123/resolv.conf",
    "/var/lib/docker/containers/abc123/hostname",
    "/var/lib/docker/containers/abc123/hosts",
    "/var/lib/docker/volumes/dados/_data",
    "/var/lib/docker/overlay2/xyz/diff",
    "/home/kadisk/EcosystemData/sockets"
]

const CONTAINER_INSPECT = {
    Id: "abc123def456",
    Name: "/meu-servico",
    Created: "2026-07-01T10:00:00Z",
    Platform: "linux",
    Driver: "overlay2",
    RestartCount: 0,
    LogPath: CAMINHOS_HOST[0],
    ResolvConfPath: CAMINHOS_HOST[1],
    HostnamePath: CAMINHOS_HOST[2],
    HostsPath: CAMINHOS_HOST[3],
    State: {
        Status: "running",
        Pid: 31337,
        ExitCode: 0,
        OOMKilled: false,
        StartedAt: "2026-07-01T10:00:01Z",
        FinishedAt: null,
        Error: ""
    },
    Config: {
        Image: "meu-servico:0.0.1",
        Hostname: "abc123",
        Env: [
            "NODE_ENV=production",
            "PORT=8080",
            `POSTGRES_PASSWORD=${SEGREDOS[0]}`,
            `GITHUB_TOKEN=${SEGREDOS[1]}`,
            `AWS_SECRET_ACCESS_KEY=${SEGREDOS[2]}`,
            `AUTHORIZATION=${SEGREDOS[3]}`,
            `DB_CREDENTIAL=${SEGREDOS[4]}`,
            `SESSION_COOKIE=${SEGREDOS[5]}`,
            "PATH=/usr/local/bin:/usr/bin",
            "SEM_VALOR="
        ],
        Labels: {
            "com.kadisk.service": "meu-servico",
            "com.kadisk.deploy-token": SEGREDOS[1]
        }
    },
    HostConfig: {
        NetworkMode: "bridge",
        Privileged: false,
        ReadonlyRootfs: false,
        Memory: 536870912,
        NanoCpus: 1000000000,
        CpuShares: 0,
        CpusetCpus: "",
        MemoryReservation: 0,
        AutoRemove: false,
        RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 },
        PortBindings: { "8080/tcp": [{ HostIp: "0.0.0.0", HostPort: "32768" }] },
        Dns: [],
        ExtraHosts: []
    },
    GraphDriver: {
        Name: "overlay2",
        Data: {
            UpperDir: CAMINHOS_HOST[5],
            LowerDir: "/var/lib/docker/overlay2/aaa/diff",
            MergedDir: "/var/lib/docker/overlay2/xyz/merged",
            WorkDir: "/var/lib/docker/overlay2/xyz/work"
        }
    },
    Mounts: [
        {
            Type: "bind",
            Source: CAMINHOS_HOST[6],
            Destination: "/mnt/host-mounts/docker-socket",
            Mode: "rw",
            RW: true
        },
        {
            Type: "volume",
            Name: "dados",
            Source: CAMINHOS_HOST[4],
            Destination: "/data",
            Mode: "z",
            RW: true
        }
    ],
    NetworkSettings: {
        Networks: { bridge: { IPAddress: "172.17.0.2", Gateway: "172.17.0.1" } },
        Ports: { "8080/tcp": [{ HostIp: "0.0.0.0", HostPort: "32768" }] }
    }
}

const IMAGE_INSPECT = {
    Id: "sha256:imagem",
    RepoTags: ["meu-servico:0.0.1"],
    RepoDigests: ["meu-servico@sha256:dig"],
    Architecture: "amd64",
    Os: "linux",
    Size: 123456,
    Created: "2026-06-01T00:00:00Z",
    DockerVersion: "27.0.0",
    Config: { Env: [`API_KEY=${SEGREDOS[2]}`, "LANG=C.UTF-8"] },
    ContainerConfig: { Env: [`DB_PASSWORD=${SEGREDOS[0]}`, "TZ=UTC"] },
    RootFS: { Type: "layers", Layers: ["sha256:l1"] },
    Labels: { maintainer: "kadisk", "build-secret": SEGREDOS[1] },
    History: [{ created_by: "RUN npm ci" }]
}

const VOLUME_INSPECT = {
    Name: "dados",
    Driver: "local",
    Mountpoint: CAMINHOS_HOST[4],
    CreatedAt: "2026-06-01T00:00:00Z",
    Scope: "local",
    Labels: { "com.kadisk.owner": "meu-servico" },
    Options: { type: "nfs", device: ":/exports", password: SEGREDOS[4] }
}

const Serializado = (valor) => JSON.stringify(valor ?? null)
const VazouSegredo = (valor) => SEGREDOS.filter((s) => Serializado(valor).includes(s))
const VazouCaminho = (valor) => CAMINHOS_HOST.filter((c) => Serializado(valor).includes(c))

const main = async () => {

    console.log("\nCONTAINER INSPECT")
    const container = SanitizeContainerRuntimePayload(CONTAINER_INSPECT)
    const env = container.Config.Env

    ok(env.includes("NODE_ENV=production") && env.includes("PORT=8080"),
        "variável inofensiva preservada com o valor")
    ok(env.includes(`POSTGRES_PASSWORD=${REDACTED}`), "password mascarado")
    ok(env.includes(`GITHUB_TOKEN=${REDACTED}`), "token mascarado")
    ok(env.includes(`AWS_SECRET_ACCESS_KEY=${REDACTED}`), "secret/key mascarado")
    ok(env.includes(`AUTHORIZATION=${REDACTED}`), "authorization mascarado")
    ok(env.includes(`DB_CREDENTIAL=${REDACTED}`), "credential mascarado")
    ok(env.includes(`SESSION_COOKIE=${REDACTED}`), "cookie de sessão mascarado")
    ok(env.includes("SEM_VALOR="), "variável sem valor atravessa sem virar máscara")
    ok(env.includes("PATH=/usr/local/bin:/usr/bin"), "PATH do container preservado (não é segredo nem caminho do host)")
    ok(env.length === CONTAINER_INSPECT.Config.Env.length, "nenhuma variável some — só o valor é escondido")

    ok(container.Config.Labels["com.kadisk.deploy-token"] === REDACTED, "label com token mascarada")
    ok(container.Config.Labels["com.kadisk.service"] === "meu-servico", "label inofensiva preservada")

    ok(container.LogPath === undefined && container.LogPathRedacted === true, "LogPath removido e sinalizado")
    ok(container.ResolvConfPath === undefined && container.ResolvConfPathRedacted === true, "ResolvConfPath removido")
    ok(container.HostnamePath === undefined && container.HostnamePathRedacted === true, "HostnamePath removido")
    ok(container.HostsPath === undefined && container.HostsPathRedacted === true, "HostsPath removido")

    ok(container.GraphDriver.Data.UpperDir === undefined
        && container.GraphDriver.Data.UpperDirRedacted === true
        && container.GraphDriver.Data.LowerDirRedacted === true,
        "diretórios do GraphDriver removidos")

    ok(container.State.Pid === undefined, "PID do host removido")
    ok(container.State.Status === "running" && container.State.ExitCode === 0, "resto do State preservado")

    const bind = container.Mounts[0]
    ok(bind.Source === undefined && bind.SourceRedacted === true, "Source do bind-mount redigido")
    ok(bind.Destination === "/mnt/host-mounts/docker-socket", "Destination (dentro do container) preservado")
    ok(bind.Type === "bind" && bind.RW === true, "tipo e modo do mount preservados")
    ok(container.Mounts[1].Name === "dados", "nome do volume preservado — identifica o recurso sem o caminho")

    ok(container.HostConfig.Privileged === false && container.HostConfig.ReadonlyRootfs === false,
        "Privileged/ReadonlyRootfs preservados de propósito: esconder postura de segurança atrapalha revisão")
    ok(container.HostConfig.PortBindings["8080/tcp"][0].HostPort === "32768", "port bindings preservados")
    ok(container.NetworkSettings.Networks.bridge.IPAddress === "172.17.0.2", "rede preservada")

    ok(VazouSegredo(container).length === 0, "VARREDURA: nenhum segredo em nenhum ponto do JSON do container")
    ok(VazouCaminho(container).length === 0, "VARREDURA: nenhum caminho de host em nenhum ponto do JSON do container")

    console.log("\nIMAGE INSPECT")
    const imagem = SanitizeContainerRuntimePayload(IMAGE_INSPECT)
    ok(imagem.Config.Env.includes(`API_KEY=${REDACTED}`), "Config.Env da imagem mascarado")
    ok(imagem.ContainerConfig.Env.includes(`DB_PASSWORD=${REDACTED}`), "ContainerConfig.Env da imagem mascarado")
    ok(imagem.Config.Env.includes("LANG=C.UTF-8"), "variável inofensiva da imagem preservada")
    ok(imagem.Labels["build-secret"] === REDACTED && imagem.Labels.maintainer === "kadisk", "labels da imagem")
    ok(imagem.RepoTags[0] === "meu-servico:0.0.1" && imagem.RootFS.Layers.length === 1, "metadados úteis preservados")
    ok(VazouSegredo(imagem).length === 0, "VARREDURA: nenhum segredo no JSON da imagem")

    console.log("\nVOLUME INSPECT")
    const volume = SanitizeContainerRuntimePayload(VOLUME_INSPECT)
    ok(volume.Mountpoint === undefined && volume.MountpointRedacted === true, "Mountpoint do volume removido")
    ok(volume.Options.password === REDACTED, "credencial em Options do driver mascarada")
    ok(volume.Options.type === "nfs" && volume.Options.device === ":/exports", "opções inofensivas preservadas")
    ok(volume.Name === "dados" && volume.Driver === "local", "identificação do volume preservada")
    ok(VazouSegredo(volume).length === 0 && VazouCaminho(volume).length === 0, "VARREDURA: volume limpo")

    console.log("\nLISTA (o mesmo payload em array)")
    const lista = SanitizeContainerRuntimePayload([CONTAINER_INSPECT, VOLUME_INSPECT])
    ok(Array.isArray(lista) && lista.length === 2, "array atravessa como array")
    ok(VazouSegredo(lista).length === 0 && VazouCaminho(lista).length === 0, "VARREDURA: lista limpa")

    console.log("\nENTRADAS DEGENERADAS")
    ok(SanitizeContainerRuntimePayload(null) === null, "null atravessa")
    ok(SanitizeContainerRuntimePayload(undefined) === undefined, "undefined atravessa")
    ok(SanitizeContainerRuntimePayload("texto") === "texto", "string atravessa")
    const aninhado = SanitizeContainerRuntimePayload({ a: { b: { c: { Config: { Env: [`X_TOKEN=${SEGREDOS[1]}`] } } } } })
    ok(aninhado.a.b.c.Config.Env[0] === `X_TOKEN=${REDACTED}`, "sanitiza em profundidade arbitrária")

    console.log("\nCONTROLLER REAL DO BFF")
    // Duplo do adapter: nenhum container real é tocado.
    const chamadas = []
    const commandExecutorLibFake = {
        require: () => async ({ CommandFunction }) => {
            const API = {
                ListAllContainers: async () => { chamadas.push("ListAllContainers"); return [CONTAINER_INSPECT] },
                ListAllImages: async () => { chamadas.push("ListAllImages"); return [IMAGE_INSPECT] },
                ListAllVolumes: async () => { chamadas.push("ListAllVolumes"); return [VOLUME_INSPECT] },
                ListAllNetworks: async () => { chamadas.push("ListAllNetworks"); return [{ Name: "bridge" }] },
                InspectContainer: async () => { chamadas.push("InspectContainer"); return CONTAINER_INSPECT },
                InspectImage: async () => { chamadas.push("InspectImage"); return IMAGE_INSPECT },
                InspectVolume: async () => { chamadas.push("InspectVolume"); return VOLUME_INSPECT },
                InspectNetwork: async () => { chamadas.push("InspectNetwork"); return { Name: "bridge", Labels: { token: SEGREDOS[1] } } },
                GetContainerLogHistory: async () => { chamadas.push("GetContainerLogHistory"); return "linha de log" }
            }
            return CommandFunction({ APIs: { ContainerRuntimeAdapterInstance: { ContainerRuntime: API } } })
        }
    }

    const controller = ContainerOrchestratorController({
        commandExecutorLib: commandExecutorLibFake,
        containerRuntimeSocketPath: "/tmp/nao-usado.sock",
        containerRuntimeServerManagerUrl: "/server-manager/status"
    })

    const leituras = [
        ["ListContainers", await controller.ListContainers()],
        ["ListImages", await controller.ListImages()],
        ["ListVolumes", await controller.ListVolumes()],
        ["InspectContainer", await controller.InspectContainer("abc")],
        ["InspectImage", await controller.InspectImage("img")],
        ["InspectVolume", await controller.InspectVolume("dados")],
        ["InspectNetwork", await controller.InspectNetwork("bridge")]
    ]
    for (const [nome, resposta] of leituras) {
        const segredos = VazouSegredo(resposta)
        const caminhos = VazouCaminho(resposta)
        ok(segredos.length === 0 && caminhos.length === 0,
            `${nome} sai sanitizado do controller${segredos.length ? ` — VAZOU: ${segredos.join(", ")}` : ""}${caminhos.length ? ` — CAMINHO: ${caminhos.join(", ")}` : ""}`)
    }

    const containerDoController = (await controller.ListContainers())[0]
    ok(containerDoController.Config.Env.includes("NODE_ENV=production"),
        "o controller não empobrece o payload: variável inofensiva continua lá")

    console.log(`\n${failures === 0 ? "TODOS OS CRITÉRIOS PASSARAM" : `${failures} FALHA(S)`}`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
    console.error("ERRO:", error)
    process.exit(1)
})
