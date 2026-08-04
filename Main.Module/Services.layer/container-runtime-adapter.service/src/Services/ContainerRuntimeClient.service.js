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

    // Pergunta e resposta: atravessa o socket, ao contrário do OpenExecSession
    // (CTMG-42). O `timeoutMs` é do lado do adaptador, onde o exec acontece.
    const RunExec = (options) =>
        ContainerRuntimeCommand((API) => API.RunExec({ options }))

    const PauseContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.PauseContainer({ containerIdOrName }))

    const UnpauseContainer = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.UnpauseContainer({ containerIdOrName }))

    const RenameContainer = (options) =>
        ContainerRuntimeCommand((API) => API.RenameContainer({ options }))

    const GetContainerStatsSnapshot = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.GetContainerStatsSnapshot({ containerIdOrName }))

    const WaitContainer = (options) =>
        ContainerRuntimeCommand((API) => API.WaitContainer({ options }))

    const PruneContainers = (options) =>
        ContainerRuntimeCommand((API) => API.PruneContainers({ options }))

    const CreateAndStartContainer = (spec) =>
        ContainerRuntimeCommand((API) => API.CreateAndStartContainer({ spec }))

    const UpdateContainerResources = (options) =>
        ContainerRuntimeCommand((API) => API.UpdateContainerResources({ options }))

    const ListContainerProcesses = (options) =>
        ContainerRuntimeCommand((API) => API.ListContainerProcesses({ options }))

    const GetContainerFileSystemChanges = (containerIdOrName) =>
        ContainerRuntimeCommand((API) => API.GetContainerFileSystemChanges({ containerIdOrName }))

    const CommitContainer = (options) =>
        ContainerRuntimeCommand((API) => API.CommitContainer({ options }))

    const PruneNetworks = (options) =>
        ContainerRuntimeCommand((API) => API.PruneNetworks({ options }))

    const PruneVolumes = (options) =>
        ContainerRuntimeCommand((API) => API.PruneVolumes({ options }))

    /* ---------------------------------------------------- imagens (CTMG-45..48) */

    const PullImage = (options) =>
        ContainerRuntimeCommand((API) => API.PullImage({ options }))

    const PushImage = (options) =>
        ContainerRuntimeCommand((API) => API.PushImage({ options }))

    const TagImage = (options) =>
        ContainerRuntimeCommand((API) => API.TagImage({ options }))

    const GetImageHistory = (imageIdOrName) =>
        ContainerRuntimeCommand((API) => API.GetImageHistory({ imageIdOrName }))

    const SearchImages = (options) =>
        ContainerRuntimeCommand((API) => API.SearchImages({ options }))

    const RegistryLogin = (options) =>
        ContainerRuntimeCommand((API) => API.RegistryLogin({ options }))

    const LoadImage = (options) =>
        ContainerRuntimeCommand((API) => API.LoadImage({ options }))

    const PruneImages = (options) =>
        ContainerRuntimeCommand((API) => API.PruneImages({ options }))

    const CheckImageUpdate = (options) =>
        ContainerRuntimeCommand((API) => API.CheckImageUpdate({ options }))

    /* ----------------------------------------------------- sistema (CTMG-50, 51) */

    const GetRuntimeInfo = () =>
        ContainerRuntimeCommand((API) => API.GetRuntimeInfo())

    const GetRuntimeVersion = () =>
        ContainerRuntimeCommand((API) => API.GetRuntimeVersion())

    const PingRuntime = () =>
        ContainerRuntimeCommand((API) => API.PingRuntime())

    const GetDiskUsage = () =>
        ContainerRuntimeCommand((API) => API.GetDiskUsage())

    const PruneSystem = (options) =>
        ContainerRuntimeCommand((API) => API.PruneSystem({ options }))

    /* --------------------------------------- arquivos de container (CTMG-44) */

    const MakeVolumeDirectory = (options) =>
        ContainerRuntimeCommand((API) => API.MakeVolumeDirectory({ options }))

    const ListContainerEntries = (options) =>
        ContainerRuntimeCommand((API) => API.ListContainerEntries({ options }))

    const CopyToContainer = (options) =>
        ContainerRuntimeCommand((API) => API.CopyToContainer({ options }))

    const CopyFromContainer = (options) =>
        ContainerRuntimeCommand((API) => API.CopyFromContainer({ options }))

    const DeleteContainerEntry = (options) =>
        ContainerRuntimeCommand((API) => API.DeleteContainerEntry({ options }))

    const MakeContainerDirectory = (options) =>
        ContainerRuntimeCommand((API) => API.MakeContainerDirectory({ options }))

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
    const StreamRuntimeEvents = RecusarPorSocket("StreamRuntimeEvents")

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
        RunExec,
        PauseContainer,
        UnpauseContainer,
        RenameContainer,
        GetContainerStatsSnapshot,
        WaitContainer,
        PruneContainers,
        CreateAndStartContainer,
        UpdateContainerResources,
        ListContainerProcesses,
        GetContainerFileSystemChanges,
        CommitContainer,
        PruneNetworks,
        PruneVolumes,
        PullImage,
        PushImage,
        TagImage,
        GetImageHistory,
        SearchImages,
        RegistryLogin,
        LoadImage,
        PruneImages,
        CheckImageUpdate,
        GetRuntimeInfo,
        GetRuntimeVersion,
        PingRuntime,
        GetDiskUsage,
        PruneSystem,
        MakeVolumeDirectory,
        ListContainerEntries,
        CopyToContainer,
        CopyFromContainer,
        DeleteContainerEntry,
        MakeContainerDirectory,
        StreamRuntimeEvents,
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