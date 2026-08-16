// O motivo de cada operação que não atravessa o socket mora no manifesto de
// superfície, junto com a própria declaração (CTMG-33).
import type { ErroDeOperacao } from "../Managers/Types"

const { UNSUPPORTED_REASON } = require("../RuntimeSurface") as {
    UNSUPPORTED_REASON: (name: string) => string
}

const CONTAINER_RUNTIME_SERVER_NAME = "ContainerRuntimeAdapterInstance"
const CONTAINER_RUNTIME_API_NAME = "ContainerRuntime"

type ContainerRuntimeClientServiceParams = {
    containerRuntimeSocketPath: string
    containerRuntimeServerManagerUrl: string
    commandExecutorLib: { require: (name: string) => any }
}

const ContainerRuntimeClientService = (params: ContainerRuntimeClientServiceParams) => {

    const {
        containerRuntimeSocketPath,
        containerRuntimeServerManagerUrl,
        commandExecutorLib
    } = params

    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const ContainerRuntimeCommand = async (CommandFunction: (API: any) => any) => {
        const APICommandFunction = async ({ APIs }: { APIs: any }) => {
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

    const CreateNewContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.CreateNewContainer({ options }))

    const BuildImageFromDockerfileString = (options: any) =>
        ContainerRuntimeCommand((API) => API.BuildImageFromDockerfileString({ options }))

    const RemoveContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.RemoveContainer({ containerIdOrName }))

    const StartContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.StartContainer({ containerIdOrName }))

    const StopContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.StopContainer({ containerIdOrName }))

    const RestartContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.RestartContainer({ containerIdOrName }))

    const KillContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.KillContainer({ containerIdOrName }))

    const InspectContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.InspectContainer({ containerIdOrName }))

    const GetContainerLogHistory = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.GetContainerLogHistory({ containerIdOrName }))

    const ExportContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.ExportContainer({ containerIdOrName }))

    // Pergunta e resposta: atravessa o socket, ao contrário do OpenExecSession
    // (CTMG-42). O `timeoutMs` é do lado do adaptador, onde o exec acontece.
    const RunExec = (options: any) =>
        ContainerRuntimeCommand((API) => API.RunExec({ options }))

    const PauseContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.PauseContainer({ containerIdOrName }))

    const UnpauseContainer = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.UnpauseContainer({ containerIdOrName }))

    const RenameContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.RenameContainer({ options }))

    const GetContainerStatsSnapshot = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.GetContainerStatsSnapshot({ containerIdOrName }))

    const WaitContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.WaitContainer({ options }))

    const PruneContainers = (options: any) =>
        ContainerRuntimeCommand((API) => API.PruneContainers({ options }))

    const CreateAndStartContainer = (spec: any) =>
        ContainerRuntimeCommand((API) => API.CreateAndStartContainer({ spec }))

    const UpdateContainerResources = (options: any) =>
        ContainerRuntimeCommand((API) => API.UpdateContainerResources({ options }))

    const ListContainerProcesses = (options: any) =>
        ContainerRuntimeCommand((API) => API.ListContainerProcesses({ options }))

    const GetContainerFileSystemChanges = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.GetContainerFileSystemChanges({ containerIdOrName }))

    const CommitContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.CommitContainer({ options }))

    const GetContainerSpec = (containerIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.GetContainerSpec({ containerIdOrName }))

    const RecreateContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.RecreateContainer({ options }))

    const PruneNetworks = (options: any) =>
        ContainerRuntimeCommand((API) => API.PruneNetworks({ options }))

    const PruneVolumes = (options: any) =>
        ContainerRuntimeCommand((API) => API.PruneVolumes({ options }))

    /* ---------------------------------------------------- imagens (CTMG-45..48) */

    const PullImage = (options: any) =>
        ContainerRuntimeCommand((API) => API.PullImage({ options }))

    const PushImage = (options: any) =>
        ContainerRuntimeCommand((API) => API.PushImage({ options }))

    const TagImage = (options: any) =>
        ContainerRuntimeCommand((API) => API.TagImage({ options }))

    const GetImageHistory = (imageIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.GetImageHistory({ imageIdOrName }))

    const SearchImages = (options: any) =>
        ContainerRuntimeCommand((API) => API.SearchImages({ options }))

    const RegistryLogin = (options: any) =>
        ContainerRuntimeCommand((API) => API.RegistryLogin({ options }))

    const LoadImage = (options: any) =>
        ContainerRuntimeCommand((API) => API.LoadImage({ options }))

    const PruneImages = (options: any) =>
        ContainerRuntimeCommand((API) => API.PruneImages({ options }))

    const CheckImageUpdate = (options: any) =>
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

    const PruneSystem = (options: any) =>
        ContainerRuntimeCommand((API) => API.PruneSystem({ options }))

    /* --------------------------------------- arquivos de container (CTMG-44) */

    const MakeVolumeDirectory = (options: any) =>
        ContainerRuntimeCommand((API) => API.MakeVolumeDirectory({ options }))

    const MoveVolumeEntry = (options: any) =>
        ContainerRuntimeCommand((API) => API.MoveVolumeEntry({ options }))

    const PutFileChunkInVolume = (options: any) =>
        ContainerRuntimeCommand((API) => API.PutFileChunkInVolume({ options }))

    const GetFileChunkFromVolume = (options: any) =>
        ContainerRuntimeCommand((API) => API.GetFileChunkFromVolume({ options }))

    const InspectVolumeUpload = (options: any) =>
        ContainerRuntimeCommand((API) => API.InspectVolumeUpload({ options }))

    const ListContainerEntries = (options: any) =>
        ContainerRuntimeCommand((API) => API.ListContainerEntries({ options }))

    const CopyToContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.CopyToContainer({ options }))

    const CopyFromContainer = (options: any) =>
        ContainerRuntimeCommand((API) => API.CopyFromContainer({ options }))

    const DeleteContainerEntry = (options: any) =>
        ContainerRuntimeCommand((API) => API.DeleteContainerEntry({ options }))

    const MakeContainerDirectory = (options: any) =>
        ContainerRuntimeCommand((API) => API.MakeContainerDirectory({ options }))

    const InspectNetwork = (networkIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.InspectNetwork({ networkIdOrName }))

    const CreateNewNetwork = (options: any) =>
        ContainerRuntimeCommand((API) => API.CreateNewNetwork({ options }))

    const RemoveNetwork = (networkIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.RemoveNetwork({ networkIdOrName }))

    const ConnectContainerToNetwork = (options: any) =>
        ContainerRuntimeCommand((API) => API.ConnectContainerToNetwork({ options }))

    const DisconnectContainerFromNetwork = (options: any) =>
        ContainerRuntimeCommand((API) => API.DisconnectContainerFromNetwork({ options }))

    const InspectVolume = (volumeName: string) =>
        ContainerRuntimeCommand((API) => API.InspectVolume({ volumeName }))

    const CreateNewVolume = (options: any) =>
        ContainerRuntimeCommand((API) => API.CreateNewVolume({ options }))

    const RemoveVolume = (volumeName: string) =>
        ContainerRuntimeCommand((API) => API.RemoveVolume({ volumeName }))

    const InspectImage = (imageIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.InspectImage({ imageIdOrName }))

    const RemoveImage = (options: any) =>
        ContainerRuntimeCommand((API) => API.RemoveImage({ options }))

    const ExportImage = (imageIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.ExportImage({ imageIdOrName }))

    const ExportVolume = (volumeName: string) =>
        ContainerRuntimeCommand((API) => API.ExportVolume({ volumeName }))

    /* ------------------------------------------- volumes e redes (E8) */

    const ImportVolume = (options: any) =>
        ContainerRuntimeCommand((API) => API.ImportVolume({ options }))

    const CloneVolume = (options: any) =>
        ContainerRuntimeCommand((API) => API.CloneVolume({ options }))

    const EmptyVolume = (options: any) =>
        ContainerRuntimeCommand((API) => API.EmptyVolume({ options }))

    const GetVolumeUsage = (volumeName: string) =>
        ContainerRuntimeCommand((API) => API.GetVolumeUsage({ volumeName }))

    const GetNetworkUsage = (networkIdOrName: string) =>
        ContainerRuntimeCommand((API) => API.GetNetworkUsage({ networkIdOrName }))

    /*
        ---- o que faltava (CTMG-34) ----

        Estes cinco atravessam o socket sem dificuldade: são pergunta e
        resposta, como todos os acima. A ausência deles não tinha motivo — só
        não haviam sido escritos, e por isso todo app fora do RING 0 ficava sem
        build por conteúdo e sem os arquivos dentro do volume.
    */
    const BuildImageFromDockerfileContent = ({ imageTagName, dockerfileContent, buildargs }: { imageTagName: string, dockerfileContent: string, buildargs?: any }) =>
        ContainerRuntimeCommand((API) => API.BuildImageFromDockerfileContent({
            options: { imageTagName, dockerfileContent, buildargs }
        }))

    const ListVolumeEntries = ({ volumeName, path }: { volumeName: string, path?: string }) =>
        ContainerRuntimeCommand((API) => API.ListVolumeEntries({ volumeName, path }))

    const PutFileInVolume = ({ volumeName, path, fileName, contentBase64 }: {
        volumeName: string
        path?: string
        fileName: string
        contentBase64?: string
    }) =>
        ContainerRuntimeCommand((API) => API.PutFileInVolume({
            volumeName, path, fileName, contentBase64
        }))

    const GetFileFromVolume = ({ volumeName, path }: { volumeName: string, path?: string }) =>
        ContainerRuntimeCommand((API) => API.GetFileFromVolume({ volumeName, path }))

    const DeleteVolumeEntry = ({ volumeName, path }: { volumeName: string, path?: string }) =>
        ContainerRuntimeCommand((API) => API.DeleteVolumeEntry({ volumeName, path }))

    /*
        ---- o que não atravessa ----

        Entrega contínua por callback não cabe no CommandExecutor, que faz uma
        chamada e devolve um valor. Lançar com o motivo é melhor que não
        existir: quem chama descobre POR QUE, e para onde ir.
    */
    const RecusarPorSocket = (name: string) => () => {
        const erro: ErroDeOperacao = new Error(
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
        GetContainerSpec,
        RecreateContainer,
        PruneNetworks,
        GetNetworkUsage,
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
        MoveVolumeEntry,
        PutFileChunkInVolume,
        GetFileChunkFromVolume,
        InspectVolumeUpload,
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
        ImportVolume,
        CloneVolume,
        EmptyVolume,
        GetVolumeUsage,
        StreamContainerLogs,
        StreamContainerStats,
        OpenExecSession,
        RegisterDockerEventListener
    })
}

module.exports = ContainerRuntimeClientService