const CONTAINER_RUNTIME_SERVER_NAME = "ContainerRuntimeAdapterInstance"
const CONTAINER_RUNTIME_API_NAME = "ContainerRuntime"

const ContainerRuntimeClientService = (params) => {

    const {
        containerRuntimeSocketPath,
        containerRuntimeServerManagerUrl,
        commandExecutorLib
    } = params

    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const ContainerRuntimeCommand = async (CommandFunction) => {
        const APICommandFunction = async ({ APIs }) => {
            const API = APIs[CONTAINER_RUNTIME_SERVER_NAME][CONTAINER_RUNTIME_API_NAME]
            return await CommandFunction(API)
        }

        return await CommandExecutor({
            serverResourceEndpointPath: containerRuntimeServerManagerUrl,
            mainApplicationSocketPath: containerRuntimeSocketPath,
            CommandFunction: APICommandFunction
        })
    }

    const ListAllContainers = () =>
        ContainerRuntimeCommand((API) => API.ListAllContainers())

    const ListAllImages = () =>
        ContainerRuntimeCommand((API) => API.ListAllImages())

    const ListAllNetworks = () =>
        ContainerRuntimeCommand((API) => API.ListAllNetworks())

    const ListAllVolumes = () =>
        ContainerRuntimeCommand((API) => API.ListAllVolumes())

    const CreateNewContainer = (options) =>
        ContainerRuntimeCommand((API) => API.CreateNewContainer({ options }))

    const BuildImageFromDockerfileString = (options) =>
        ContainerRuntimeCommand((API) => API.BuildImageFromDockerfileString({ options }))

    const RemoveContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.RemoveContainer({ containerIdOrName }))

    const StartContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.StartContainer({ containerIdOrName }))

    const StopContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.StopContainer({ containerIdOrName }))

    const RestartContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.RestartContainer({ containerIdOrName }))

    const KillContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.KillContainer({ containerIdOrName }))

    const InspectContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.InspectContainer({ containerIdOrName }))

    const GetContainerLogHistory = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.GetContainerLogHistory({ containerIdOrName }))

    const ExportContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.ExportContainer({ containerIdOrName }))

    const InspectNetwork = (networkIdOrName) =>
        ContainerRuntimeCommand((API) => API.InspectNetwork({ networkIdOrName }))

    const CreateNewNetwork = (options) =>
        ContainerRuntimeCommand((API) => API.CreateNewNetwork({ options }))

    const RemoveNetwork = (networkIdOrName) =>
        ContainerRuntimeCommand((API) => API.RemoveNetwork({ networkIdOrName }))

    const ConnectContainerToNetwork = (options) =>
        ContainerRuntimeCommand((API) => API.ConnectContainerToNetwork({ options }))

    const DisconnectContainerFromNetwork = (options) =>
        ContainerRuntimeCommand((API) => API.DisconnectContainerFromNetwork({ options }))

    const InspectVolume = (volumeName) =>
        ContainerRuntimeCommand((API) => API.InspectVolume({ volumeName }))

    const CreateNewVolume = (options) =>
        ContainerRuntimeCommand((API) => API.CreateNewVolume({ options }))

    const RemoveVolume = (volumeName) =>
        ContainerRuntimeCommand((API) => API.RemoveVolume({ volumeName }))

    const InspectImage = (imageIdOrName) =>
        ContainerRuntimeCommand((API) => API.InspectImage({ imageIdOrName }))

    const RemoveImage = (options) =>
        ContainerRuntimeCommand((API) => API.RemoveImage({ options }))

    const ExportImage = (imageIdOrName) =>
        ContainerRuntimeCommand((API) => API.ExportImage({ imageIdOrName }))

    const ExportVolume = (volumeName) =>
        ContainerRuntimeCommand((API) => API.ExportVolume({ volumeName }))

    const RegisterDockerEventListener = () => {
        throw new Error("RegisterDockerEventListener não está disponível via ContainerRuntimeClient (unix socket). Apenas o ContainerRuntimeAdapter em processo (RING 0) expõe o stream de eventos do Docker.")
    }

    return Object.freeze({
        ListAllContainers,
        ListAllImages,
        ListAllNetworks,
        ListAllVolumes,
        CreateNewContainer,
        BuildImageFromDockerfileString,
        RemoveContainer,
        StartContainer,
        StopContainer,
        RestartContainer,
        KillContainer,
        InspectContainer,
        GetContainerLogHistory,
        ExportContainer,
        InspectNetwork,
        CreateNewNetwork,
        RemoveNetwork,
        ConnectContainerToNetwork,
        DisconnectContainerFromNetwork,
        InspectVolume,
        CreateNewVolume,
        RemoveVolume,
        InspectImage,
        RemoveImage,
        ExportImage,
        ExportVolume,
        RegisterDockerEventListener
    })
}

module.exports = ContainerRuntimeClientService