/*
    Operações de REDE (CTMG-36).

    Não existe alteração in-place da configuração de uma rede no Docker: o que
    se "edita" numa rede é QUEM está conectado a ela — daí connect/disconnect
    ocuparem o lugar de um update.
*/

const {
    NormalizeNetworkAliases
} = require("../Helpers/BuildContainerNetworkConfiguration")

const CreateNetworkOperations = ({ docker }) => {

    const ListAllNetworks = async () => {
        try {
            const networks = await docker.listNetworks()
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

    const CreateNewNetwork = async (options) => {
        try {
            const network = await docker.createNetwork(options)
            return network
        }
        catch (error) {
            console.error(`Error creating network ${options.Name || 'unknown'}:`, error)
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
        ConnectContainerToNetwork,
        DisconnectContainerFromNetwork
    }
}

module.exports = CreateNetworkOperations
