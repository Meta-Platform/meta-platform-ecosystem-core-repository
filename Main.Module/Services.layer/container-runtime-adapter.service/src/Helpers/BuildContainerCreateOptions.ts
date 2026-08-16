/*
    Do ContainerSpec para o JSON que a API do Docker aceita (CTMG-54).

    Função pura, e é o coração do épico: os ~60 campos do formulário viram uma
    chamada de criação aqui, uma vez, em vez de espalhados por cada tela que
    quiser criar container.

    ## Normalização retroativa (CTMG-55)

    `CreateNewContainer` tem chamador em OUTRO REPOSITÓRIO:
    `ServiceOrchestrator.manager.js`, no VirtualDeskRepo, que provisiona a nuvem
    corporativa. A forma antiga — `{ imageName, containerName, ports,
    networkmode, networkAliases, mounts, environment }` — continua entrando e
    produzindo exatamente o mesmo JSON de antes. Há teste de regressão com a
    chamada literal daquele arquivo.
*/

import type { ContainerSpecInput } from "../Operations/Types"

const {
    BuildHealthcheck,
    BuildRestartPolicy,
    BuildResources,
    NormalizeStringList,
    NormalizarMapaDeTexto
} = require("./ContainerSpec")
const {
    NormalizeMounts,
    NormalizePorts,
    ResolveGroupAdd
} = require("./NormalizeContainerCreateInput")
const NormalizeContainerEnvironment = require("./NormalizeContainerEnvironment")
const {
    BuildContainerNetworkConfiguration
} = require("./BuildContainerNetworkConfiguration")

/*
    A forma antiga tem nomes próprios (`imageName`, `containerName`,
    `networkmode`) que não existem no spec novo. Traduzir aqui, e não em cada
    chamador, é o que permite mudar o contrato sem tocar em quem chama.
*/
const NormalizeLegacySpec = (entrada: ContainerSpecInput = {}): ContainerSpecInput => {
    const ehLegado = entrada.imageName !== undefined
        || entrada.containerName !== undefined
        || entrada.networkmode !== undefined
        || entrada.networkAliases !== undefined

    if (!ehLegado) return entrada

    const {
        imageName,
        containerName,
        networkmode,
        networkAliases,
        environment,
        groupAdd,
        inheritHostGroups,
        ...resto
    } = entrada

    return {
        ...resto,
        image: imageName,
        name: containerName,
        env: environment,
        ...(networkmode !== undefined || networkAliases !== undefined
            ? {
                network: {
                    ...(networkmode !== undefined ? { mode: networkmode } : {}),
                    ...(networkAliases !== undefined ? { aliases: networkAliases } : {})
                }
            }
            : {}),
        security: {
            ...(entrada.security || {}),
            ...(groupAdd !== undefined ? { groupAdd } : {})
        },
        ...(inheritHostGroups !== undefined ? { inheritHostGroups } : {})
    }
}

const ComValor = (chave: string, valor: unknown): Record<string, any> =>
    valor === undefined || valor === null || valor === "" ? {} : { [chave]: valor }

const BuildContainerCreateOptions = (entrada: ContainerSpecInput = {}) => {
    const spec = NormalizeLegacySpec(entrada)

    const { exposedPorts, portBindings } = NormalizePorts(spec.ports || [])
    const montagens = NormalizeMounts(spec.mounts || [])
    const gruposSuplementares = ResolveGroupAdd({
        groupAdd: spec.security?.groupAdd,
        inheritHostGroups: spec.inheritHostGroups
    })

    const variaveis = NormalizeContainerEnvironment(spec.env || {})
    const configuracaoDeRede = BuildContainerNetworkConfiguration({
        networkmode: spec.network?.mode,
        networkAliases: spec.network?.aliases || []
    })

    const healthcheck = BuildHealthcheck(spec.healthcheck)
    const politicaDeReinicio = BuildRestartPolicy(spec.restart)
    const recursos = BuildResources(spec.resources || {})

    const hostConfig = {
        PortBindings: portBindings,
        NetworkMode: spec.network?.mode,
        Mounts: montagens,
        ...(gruposSuplementares.length > 0 ? { GroupAdd: gruposSuplementares } : {}),
        ...(politicaDeReinicio ? { RestartPolicy: politicaDeReinicio } : {}),
        ...ComValor("AutoRemove", spec.autoRemove === true ? true : undefined),
        ...ComValor("Init", spec.init === true ? true : undefined),
        ...ComValor("Privileged", spec.security?.privileged === true ? true : undefined),
        ...ComValor("ReadonlyRootfs", spec.security?.readonlyRootfs === true ? true : undefined),
        ...ComValor("PublishAllPorts", spec.publishAllPorts === true ? true : undefined),
        ...ComValor("CapAdd", NormalizeStringList(spec.security?.capAdd)),
        ...ComValor("CapDrop", NormalizeStringList(spec.security?.capDrop)),
        ...ComValor("SecurityOpt", NormalizeStringList(spec.security?.securityOpt)),
        ...ComValor("VolumesFrom", NormalizeStringList(spec.volumesFrom)),
        ...ComValor("ExtraHosts", NormalizeStringList(spec.extraHosts)),
        ...ComValor("Dns", NormalizeStringList(spec.dns?.servers)),
        ...ComValor("DnsSearch", NormalizeStringList(spec.dns?.search)),
        ...ComValor("DnsOptions", NormalizeStringList(spec.dns?.options)),
        ...ComValor("Sysctls", NormalizarMapaDeTexto(spec.sysctls)),
        ...ComValor("IpcMode", spec.namespaces?.ipcMode),
        ...ComValor("PidMode", spec.namespaces?.pidMode),
        ...ComValor("UTSMode", spec.namespaces?.utsMode),
        ...ComValor("ShmSize", spec.namespaces?.shmSizeBytes),
        ...ComValor("Runtime", spec.runtime),
        ...(Array.isArray(spec.devices) && spec.devices.length > 0
            ? {
                /*
                    Sem destino declarado, o dispositivo aparece no container
                    no MESMO caminho do host — é o que `--device /dev/dri`
                    faz. Deixar `PathInContainer` indefinido criaria o
                    container sem o dispositivo, calado.
                */
                Devices: spec.devices.map((d) => {
                    const noHost = d.pathOnHost || d.path
                    return {
                        PathOnHost: noHost,
                        PathInContainer: d.pathInContainer || d.path || noHost,
                        CgroupPermissions: d.permissions || "rwm"
                    }
                })
            }
            : {}),
        ...(spec.logging?.driver
            ? {
                LogConfig: {
                    Type: spec.logging.driver,
                    ...(spec.logging.options ? { Config: NormalizarMapaDeTexto(spec.logging.options) } : {})
                }
            }
            : {}),
        ...recursos
    }

    /*
        `NoNewPrivileges` não é campo próprio: vive dentro de SecurityOpt, como
        texto. É o tipo de detalhe que faz uma tela oferecer um interruptor que
        não tem efeito nenhum.
    */
    if (spec.security?.noNewPrivileges) {
        hostConfig.SecurityOpt = [...(hostConfig.SecurityOpt || []), "no-new-privileges:true"]
    }

    return {
        Image: spec.image,
        ...ComValor("name", spec.name),
        ...ComValor("platform", spec.platform),
        ...(variaveis.length > 0 ? { Env: variaveis } : {}),
        ExposedPorts: exposedPorts,
        ...ComValor("Cmd", NormalizeStringList(spec.command)),
        ...ComValor("Entrypoint", NormalizeStringList(spec.entrypoint)),
        ...ComValor("WorkingDir", spec.workingDir),
        ...ComValor("User", spec.user),
        ...ComValor("Hostname", spec.hostname),
        ...ComValor("Domainname", spec.domainname),
        ...ComValor("Tty", spec.tty === true ? true : undefined),
        ...ComValor("OpenStdin", spec.openStdin === true ? true : undefined),
        ...ComValor("StdinOnce", spec.stdinOnce === true ? true : undefined),
        ...ComValor("StopSignal", spec.stopSignal),
        ...ComValor("StopTimeout", spec.stopTimeoutSeconds !== undefined
            ? Number(spec.stopTimeoutSeconds)
            : undefined),
        ...ComValor("Labels", NormalizarMapaDeTexto(spec.labels)),
        ...(healthcheck ? { Healthcheck: healthcheck } : {}),
        HostConfig: hostConfig,
        ...configuracaoDeRede
    }
}

module.exports = BuildContainerCreateOptions
module.exports.NormalizeLegacySpec = NormalizeLegacySpec
