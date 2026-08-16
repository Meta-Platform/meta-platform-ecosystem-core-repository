/*
    Operações de REDE (CTMG-36).

    Não existe alteração in-place da configuração de uma rede no Docker: o que
    se "edita" numa rede é QUEM está conectado a ela — daí connect/disconnect
    ocuparem o lugar de um update.
*/

import type { DockerFilters, DockerPayload, NetworkOperationsContext } from "./Types"

const {
    NormalizeNetworkAliases
} = require("../Helpers/BuildContainerNetworkConfiguration")
const NormalizeDockerFilters = require("../Helpers/NormalizeDockerFilters")
const BuildPruneOptions = require("../Helpers/BuildPruneOptions")
// Gateway fora da sub-rede é aceito pelo daemon e deixa a rede sem saída —
// por isso a validação vem antes da chamada (CTMG-49).
const BuildNetworkOptions = require("../Helpers/BuildNetworkOptions")

const BuildFilterOption = (filters?: DockerFilters) => {
    const normalizados = NormalizeDockerFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

const CreateNetworkOperations = ({ docker }: NetworkOperationsContext) => {

    /*
        Chamada sem argumento mantém o comportamento de antes (CTMG-41).
        `filters` aceita driver, label, name, scope, type.
    */
    const ListAllNetworks = async ({ filters }: { filters?: DockerFilters } = {}) => {
        try {
            const networks = await docker.listNetworks(BuildFilterOption(filters))
            return networks
        }
        catch (error) {
            console.error('Error listing networks:', error)
            throw error
        }

    }

    /*
        QUEM USA ESTA REDE (CTMG-102).

        O `inspect` da rede já traz os containers conectados — mas só com IP e
        nome. O que falta é justamente o que interessa para diagnosticar:

        - os **aliases** de DNS, que são como um container acha o outro. Sem
          eles, "por que o app não enxerga o banco?" não tem resposta na tela;
        - a **stack** a que cada um pertence, que transforma uma lista de nomes
          soltos em "estes cinco são o mesmo compose".

        Os dois vivem no container, não na rede. Daí a segunda volta.
    */
    const GetNetworkUsage = async (networkIdOrName: string) => {
        const rede = await docker.getNetwork(networkIdOrName).inspect()
        const conectados = Object.entries(rede.Containers || {})

        const containers = await Promise.all(conectados.map(async ([id, dados]: [string, DockerPayload]) => {
            const base = {
                id,
                name: dados.Name,
                ipv4: (dados.IPv4Address || "").split("/")[0] || null,
                ipv6: (dados.IPv6Address || "").split("/")[0] || null,
                macAddress: dados.MacAddress || null,
                aliases: [],
                stack: null,
                service: null,
                state: null
            }

            try {
                const inspecao = await docker.getContainer(id).inspect()
                const naRede = inspecao.NetworkSettings?.Networks?.[rede.Name]
                const labels = inspecao.Config?.Labels || {}

                return {
                    ...base,
                    // O próprio id curto entra como alias em toda rede; ele não
                    // é escolha de ninguém e só polui a lista.
                    aliases: (naRede?.Aliases || []).filter((alias: string) => !id.startsWith(alias)),
                    stack: labels["com.docker.compose.project"]
                        || labels["com.metaplatform.container-manager.stack"]
                        || null,
                    service: labels["com.docker.compose.service"]
                        || labels["com.metaplatform.container-manager.stack-service"]
                        || null,
                    state: inspecao.State?.Status || null
                }
            } catch (error) {
                // Container que sumiu entre o inspect da rede e o dele: a rede
                // ainda o lista, e mostrar o que se sabe é melhor que omitir.
                return base
            }
        }))

        const Distintos = (valores: any[]) =>
            Array.from(new Set(valores.filter(Boolean)))

        return {
            id: rede.Id,
            name: rede.Name,
            driver: rede.Driver,
            scope: rede.Scope,
            internal: Boolean(rede.Internal),
            ipam: rede.IPAM || null,
            labels: rede.Labels || {},
            containers,
            stacks: Distintos(containers.map((c) => c.stack)),
            services: Distintos(containers.map((c) => c.service)),
            // As três redes que o Docker cria sozinho nunca são removíveis, e a
            // tela precisa saber disso antes de oferecer o botão.
            removable: !["bridge", "host", "none"].includes(rede.Name)
        }
    }

    const InspectNetwork = async (networkIdOrName: string) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            const networkInfo = await network.inspect()
            return networkInfo
        }
        catch (error) {
            console.error(`Error inspecting network ${networkIdOrName}:`, error)
            throw error
        }
    }

    /*
        Criação de rede (CTMG-49).

        Aceita as duas formas: o objeto do Docker (`{ Name, Driver, IPAM }`),
        que é como sempre foi chamado, e a forma canônica em minúsculas com
        IPAM validado. Reconhecer a forma antiga pelo `Name` maiúsculo evita
        quebrar quem já chama certo.
    */
    const CreateNewNetwork = async (options: DockerPayload) => {
        const pedido = options && options.Name !== undefined
            ? options
            : BuildNetworkOptions(options)

        try {
            const network = await docker.createNetwork(pedido)
            return network
        }
        catch (error) {
            console.error(`Error creating network ${pedido.Name || 'unknown'}:`, error)
            throw error
        }
    }

    /*
        PODA DE REDES (CTMG-49).

        Remove as redes sem nenhum container conectado. A menos destrutiva das
        quatro podas — rede se recria com a mesma configuração —, mas ainda
        assim leva junto a rede que alguém preparou para uma stack que ainda
        não subiu.
    */
    const PruneNetworks = async ({ filters }: { filters?: DockerFilters } = {}) => {
        try {
            const resultado = await docker.pruneNetworks(BuildPruneOptions(filters))
            return {
                NetworksDeleted: resultado?.NetworksDeleted || [],
                SpaceReclaimed: resultado?.SpaceReclaimed || 0
            }
        } catch (error) {
            console.error("Error pruning networks:", error)
            throw error
        }
    }

    const RemoveNetwork = async (networkIdOrName: string) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            await network.remove()
            return { success: true, message: `Network ${networkIdOrName} removed successfully` }
        }
        catch (error) {
            console.error(`Error removing network ${networkIdOrName}:`, error)
            throw error
        }
    }

    // "Edição" de network no Docker = conectar/desconectar containers
    // (não existe update in-place da configuração de uma network).
    const ConnectContainerToNetwork = async ({
        networkIdOrName,
        containerIdOrName,
        aliases = []
    }: { networkIdOrName: string, containerIdOrName: string, aliases?: string[] }) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            const normalizedAliases = NormalizeNetworkAliases(aliases)
            await network.connect({
                Container: containerIdOrName,
                ...(normalizedAliases.length > 0
                    ? {
                        EndpointConfig: {
                            Aliases: normalizedAliases
                        }
                    }
                    : {})
            })
            return { success: true, message: `Container ${containerIdOrName} connected to ${networkIdOrName}` }
        }
        catch (error) {
            console.error(`Error connecting container ${containerIdOrName} to network ${networkIdOrName}:`, error)
            throw error
        }
    }

    const DisconnectContainerFromNetwork = async ({ networkIdOrName, containerIdOrName }: { networkIdOrName: string, containerIdOrName: string }) => {
        try {
            const network = docker.getNetwork(networkIdOrName)
            await network.disconnect({ Container: containerIdOrName, Force: true })
            return { success: true, message: `Container ${containerIdOrName} disconnected from ${networkIdOrName}` }
        }
        catch (error) {
            console.error(`Error disconnecting container ${containerIdOrName} from network ${networkIdOrName}:`, error)
            throw error
        }
    }

    return {
        ListAllNetworks,
        InspectNetwork,
        CreateNewNetwork,
        RemoveNetwork,
        PruneNetworks,
        ConnectContainerToNetwork,
        DisconnectContainerFromNetwork,
        GetNetworkUsage
    }
}

module.exports = CreateNetworkOperations
