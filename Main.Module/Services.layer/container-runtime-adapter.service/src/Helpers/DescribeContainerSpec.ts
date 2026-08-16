/*
    Do container que existe de volta para o ContainerSpec (CTMG-56).

    Quatro funcionalidades dependem desta função e de mais nada:

      editar (CTMG-59)      — abre o formulário preenchido
      duplicar (CTMG-60)    — abre o formulário com outro nome
      copiar o comando      — RenderDockerRun(spec) (CTMG-61)
      stack de existentes   — promover containers avulsos (CTMG-125)

    É a razão de o spec existir como representação única: sem a volta, cada uma
    dessas telas leria o `inspect` do seu jeito e produziria um container
    ligeiramente diferente do original.

    Pura, e com teste de IDA E VOLTA: descrever o resultado de
    BuildContainerCreateOptions tem de devolver o spec de onde se partiu.
*/

import type { ContainerSpec, DockerPayload } from "../Operations/Types"

const { SEGUNDOS_EM_NANOSSEGUNDOS } = require("./ContainerSpec")

const SemVazios = (objeto: Record<string, any>): Record<string, any> =>
    Object.fromEntries(
        Object.entries(objeto).filter(([, valor]) => {
            if (valor === undefined || valor === null || valor === "") return false
            if (Array.isArray(valor) && valor.length === 0) return false
            if (typeof valor === "object" && !Array.isArray(valor) && Object.keys(valor).length === 0) return false
            return true
        })
    )

/*
    O ambiente do inspect traz TAMBÉM as variáveis que a imagem definiu — PATH
    é o exemplo universal. Recriar um container repetindo-as como se fossem do
    usuário engorda o spec com ruído e, pior, congela um PATH que deveria vir
    da imagem nova quando ela for atualizada.

    Por isso o descritor subtrai o ambiente da imagem, quando ele é conhecido.
*/
const DescreverAmbiente = (envDoContainer: string[] = [], envDaImagem: string[] = []) => {
    const daImagem = new Set(envDaImagem)

    return Object.fromEntries(
        envDoContainer
            .filter((linha) => !daImagem.has(linha))
            .map((linha) => {
                const igual = linha.indexOf("=")
                return igual === -1 ? [linha, ""] : [linha.slice(0, igual), linha.slice(igual + 1)]
            })
    )
}

const DescreverPortas = (config: DockerPayload = {}, hostConfig: DockerPayload = {}) => {
    const expostas = Object.keys(config.ExposedPorts || {})
    const vinculos = hostConfig.PortBindings || {}

    return expostas.map((chave) => {
        const [porta, protocolo] = chave.split("/")
        const vinculo = (vinculos[chave] || [])[0]

        return SemVazios({
            containerPort: Number(porta),
            hostPort: vinculo?.HostPort ? Number(vinculo.HostPort) : undefined,
            hostIp: vinculo?.HostIp || undefined,
            protocol: protocolo === "tcp" ? undefined : protocolo
        })
    })
}

const DescreverMontagens = (mounts: DockerPayload = [], hostConfig: DockerPayload = {}) => {
    // `Mounts` do inspect é a forma resolvida, com o que o daemon de fato usou.
    if (Array.isArray(mounts) && mounts.length > 0) {
        return mounts.map((m: DockerPayload) => SemVazios({
            type: m.Type,
            source: m.Type === "volume" ? m.Name : m.Source,
            target: m.Destination,
            readOnly: m.RW === false ? true : undefined
        }))
    }

    // Container criado só com `Binds` (forma antiga) não popula Mounts.
    return (hostConfig.Binds || []).map((bind: unknown) => {
        const [origem, destino, opcoes] = String(bind).split(":")
        return SemVazios({
            type: origem.startsWith("/") ? "bind" : "volume",
            source: origem,
            target: destino,
            readOnly: opcoes === "ro" ? true : undefined
        })
    })
}

const DescreverSaude = (healthcheck: DockerPayload) => {
    if (!healthcheck) return undefined

    const teste = healthcheck.Test || []
    if (teste.length === 1 && teste[0] === "NONE") return { disable: true }

    const EmSegundos = (nanos: unknown) => nanos === undefined || nanos === null
        ? undefined
        : Number(nanos) / SEGUNDOS_EM_NANOSSEGUNDOS

    return SemVazios({
        // `["CMD-SHELL", "curl ..."]` volta como texto, que é o que o
        // formulário mostra; qualquer outra forma volta como lista.
        test: teste[0] === "CMD-SHELL" && teste.length === 2 ? teste[1] : teste,
        intervalSeconds: EmSegundos(healthcheck.Interval),
        timeoutSeconds: EmSegundos(healthcheck.Timeout),
        startPeriodSeconds: EmSegundos(healthcheck.StartPeriod),
        retries: healthcheck.Retries
    })
}

const DescreverRecursos = (hostConfig: DockerPayload = {}) => SemVazios({
    memoryBytes: hostConfig.Memory || undefined,
    memoryReservationBytes: hostConfig.MemoryReservation || undefined,
    memorySwapBytes: hostConfig.MemorySwap || undefined,
    // Devolve `cpus` e não `nanoCpus`: é o que o formulário pergunta.
    cpus: hostConfig.NanoCpus ? hostConfig.NanoCpus / 1e9 : undefined,
    cpuShares: hostConfig.CpuShares || undefined,
    cpusetCpus: hostConfig.CpusetCpus || undefined,
    pidsLimit: hostConfig.PidsLimit || undefined,
    blkioWeight: hostConfig.BlkioWeight || undefined,
    ulimits: (hostConfig.Ulimits || []).map((u: DockerPayload) => ({ name: u.Name, soft: u.Soft, hard: u.Hard }))
})

const DescreverRede = (
    config: DockerPayload = {},
    hostConfig: DockerPayload = {},
    networkSettings: DockerPayload = {}
) => {
    const redes = networkSettings.Networks || {}
    const nomes = Object.keys(redes)
    const modo = hostConfig.NetworkMode

    const principal = modo && redes[modo] ? redes[modo] : (nomes.length > 0 ? redes[nomes[0]] : null)

    return SemVazios({
        mode: modo,
        aliases: principal?.Aliases || undefined,
        ipv4Address: principal?.IPAMConfig?.IPv4Address || undefined,
        extraNetworks: nomes.filter((nome) => nome !== modo)
    })
}

/*
    `imageEnv` chega de fora porque o inspect de um container NÃO traz a
    configuração da imagem — é preciso um segundo `inspect`, o da imagem, e
    esta função é pura.

    Sem ele o spec sai com PATH, LANG e as variáveis internas da imagem
    (PG_VERSION, GOSU_VERSION…) como se fossem do usuário. Recriar a partir
    desse spec CONGELA a versão que estava na imagem antiga: atualizar o
    Postgres passaria a criar um container anunciando a versão anterior.

    Foi assim que apareceu — recriando um postgres:16-alpine de verdade e
    olhando o spec devolvido.
*/
const DescribeContainerSpec = (
    inspect: DockerPayload = {},
    { imageEnv }: { imageEnv?: string[] } = {}
): ContainerSpec => {
    const config = inspect.Config || {}
    const hostConfig = inspect.HostConfig || {}
    const imagem = { Env: imageEnv || inspect.ImageConfig?.Env || [] }

    const politica = hostConfig.RestartPolicy

    return SemVazios({
        image: config.Image,
        name: String(inspect.Name || "").replace(/^\//, "") || undefined,
        platform: inspect.Platform,
        command: config.Cmd || undefined,
        entrypoint: config.Entrypoint || undefined,
        workingDir: config.WorkingDir || undefined,
        user: config.User || undefined,
        hostname: config.Hostname || undefined,
        tty: config.Tty === true ? true : undefined,
        openStdin: config.OpenStdin === true ? true : undefined,
        env: DescreverAmbiente(config.Env || [], imagem.Env || []),
        labels: config.Labels || undefined,
        ports: DescreverPortas(config, hostConfig),
        publishAllPorts: hostConfig.PublishAllPorts === true ? true : undefined,
        mounts: DescreverMontagens(inspect.Mounts, hostConfig),
        volumesFrom: hostConfig.VolumesFrom || undefined,
        network: DescreverRede(config, hostConfig, inspect.NetworkSettings),
        extraHosts: hostConfig.ExtraHosts || undefined,
        dns: SemVazios({
            servers: hostConfig.Dns || undefined,
            search: hostConfig.DnsSearch || undefined,
            options: hostConfig.DnsOptions || undefined
        }),
        restart: politica && politica.Name && politica.Name !== "no"
            ? SemVazios({
                policy: politica.Name,
                maximumRetryCount: politica.MaximumRetryCount || undefined
            })
            : undefined,
        autoRemove: hostConfig.AutoRemove === true ? true : undefined,
        init: hostConfig.Init === true ? true : undefined,
        stopSignal: config.StopSignal || undefined,
        stopTimeoutSeconds: config.StopTimeout || undefined,
        healthcheck: DescreverSaude(config.Healthcheck),
        resources: DescreverRecursos(hostConfig),
        devices: (hostConfig.Devices || []).map((d: DockerPayload) => SemVazios({
            pathOnHost: d.PathOnHost,
            pathInContainer: d.PathInContainer,
            permissions: d.CgroupPermissions
        })),
        security: SemVazios({
            privileged: hostConfig.Privileged === true ? true : undefined,
            capAdd: hostConfig.CapAdd || undefined,
            capDrop: hostConfig.CapDrop || undefined,
            securityOpt: (hostConfig.SecurityOpt || []).filter((o: unknown) => o !== "no-new-privileges:true"),
            noNewPrivileges: (hostConfig.SecurityOpt || []).includes("no-new-privileges:true") || undefined,
            readonlyRootfs: hostConfig.ReadonlyRootfs === true ? true : undefined,
            groupAdd: hostConfig.GroupAdd || undefined
        }),
        sysctls: hostConfig.Sysctls || undefined,
        namespaces: SemVazios({
            ipcMode: hostConfig.IpcMode || undefined,
            pidMode: hostConfig.PidMode || undefined,
            utsMode: hostConfig.UTSMode || undefined,
            shmSizeBytes: hostConfig.ShmSize || undefined
        }),
        logging: hostConfig.LogConfig?.Type
            ? SemVazios({
                driver: hostConfig.LogConfig.Type,
                options: hostConfig.LogConfig.Config || undefined
            })
            : undefined,
        runtime: hostConfig.Runtime || undefined
    })
}

module.exports = DescribeContainerSpec
module.exports.DescreverAmbiente = DescreverAmbiente
