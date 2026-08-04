/*
    Operações de REDE (CTMG-36).

    Não existe alteração in-place da configuração de uma rede no Docker: o que
    se "edita" numa rede é QUEM está conectado a ela — daí connect/disconnect
    ocuparem o lugar de um update.
*/

const {
    NormalizeNetworkAliases
} = require("../Helpers/BuildContainerNetworkConfiguration")
const NormalizeDockerFilters = require("../Helpers/NormalizeDockerFilters")
const BuildPruneOptions = require("../Helpers/BuildPruneOptions")
// Gateway fora da sub-rede é aceito pelo daemon e deixa a rede sem saída —
// por isso a validação vem antes da chamada (CTMG-49).
const BuildNetworkOptions = require("../Helpers/BuildNetworkOptions")

const BuildFilterOption = (filters) => {
    const normalizados = NormalizeDockerFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

const CreateNetworkOperations = ({ docker }) => {

    /*
        Chamada sem argumento mantém o comportamento de antes (CTMG-41).
        `filters` aceita driver, label, name, scope, type.
    */
    const ListAllNetworks = async ({ filters } = {}) => {
        try {
            const networks = await docker.listNetworks(BuildFilterOption(filters))
            return networks
        }
        catch (error) {
            console.error('Error listing networks:', error)
            throw error
        }

    }

    const InspectNetwork = async (networkIdOrName) => {
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
    const CreateNewNetwork = async (options) => {
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
    const PruneNetworks = async ({ filters } = {}) => {
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

    const RemoveNetwork = async (networkIdOrName) => {
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
    }) => {
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

    const DisconnectContainerFromNetwork = async ({ networkIdOrName, containerIdOrName }) => {
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
        DisconnectContainerFromNetwork
    }
}

module.exports = CreateNetworkOperations
