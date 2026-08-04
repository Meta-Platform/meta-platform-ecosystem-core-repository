// O motivo de cada operação que não atravessa o socket mora no manifesto de
// superfície, junto com a própria declaração (CTMG-33).
const { UNSUPPORTED_REASON } = require("../RuntimeSurface")

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

    /*
        ---- o que faltava (CTMG-34) ----

        Estes cinco atravessam o socket sem dificuldade: são pergunta e
        resposta, como todos os acima. A ausência deles não tinha motivo — só
        não haviam sido escritos, e por isso todo app fora do RING 0 ficava sem
        build por conteúdo e sem os arquivos dentro do volume.
    */
    const BuildImageFromDockerfileContent = ({ imageTagName, dockerfileContent, buildargs }) =>
        ContainerRuntimeCommand((API) => API.BuildImageFromDockerfileContent({
            options: { imageTagName, dockerfileContent, buildargs }
        }))

    const ListVolumeEntries = ({ volumeName, path }) =>
        ContainerRuntimeCommand((API) => API.ListVolumeEntries({ volumeName, path }))

    const PutFileInVolume = ({ volumeName, path, fileName, contentBase64 }) =>
        ContainerRuntimeCommand((API) => API.PutFileInVolume({
            volumeName, path, fileName, contentBase64
        }))

    const GetFileFromVolume = ({ volumeName, path }) =>
        ContainerRuntimeCommand((API) => API.GetFileFromVolume({ volumeName, path }))

    const DeleteVolumeEntry = ({ volumeName, path }) =>
        ContainerRuntimeCommand((API) => API.DeleteVolumeEntry({ volumeName, path }))

    /*
        ---- o que não atravessa ----

        Entrega contínua por callback não cabe no CommandExecutor, que faz uma
        chamada e devolve um valor. Lançar com o motivo é melhor que não
        existir: quem chama descobre POR QUE, e para onde ir.
    */
    const RecusarPorSocket = (name) => () => {
        const erro = new Error(
            `${name} não está disponível pelo ContainerRuntimeClient. ${UNSUPPORTED_REASON(name)}`
        )
        erro.code = "STREAM_UNSUPPORTED_OVER_SOCKET"
        erro.operation = name
        throw erro
    }

    const StreamContainerLogs = RecusarPorSocket("StreamContainerLogs")
    const StreamContainerStats = RecusarPorSocket("StreamContainerStats")
    const OpenExecSession = RecusarPorSocket("OpenExecSession")
    const RegisterDockerEventListener = RecusarPorSocket("RegisterDockerEventListener")

    return Object.freeze({
        ListAllContainers,
        ListAllImages,
        ListAllNetworks,
        ListAllVolumes,
        CreateNewContainer,
        BuildImageFromDockerfileString,
        BuildImageFromDockerfileContent,
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
        ListVolumeEntries,
        PutFileInVolume,
        GetFileFromVolume,
        DeleteVolumeEntry,
        InspectImage,
        RemoveImage,
        ExportImage,
        ExportVolume,
        StreamContainerLogs,
        StreamContainerStats,
        OpenExecSession,
        RegisterDockerEventListener
    })
}

module.exports = ContainerRuntimeClientService