const ContainerRuntimeController = (params) => {

    const {
        containerRuntimeAdapterService
    } = params

    const controllerServiceObject = {
        controllerName                 : "ContainerRuntimeController",
        ListAllContainers              : containerRuntimeAdapterService.ListAllContainers,
        ListAllImages                  : containerRuntimeAdapterService.ListAllImages,
        ListAllNetworks                : containerRuntimeAdapterService.ListAllNetworks,
        ListAllVolumes                 : containerRuntimeAdapterService.ListAllVolumes,
        // Arquivos DENTRO de um volume (VDRP-260) — só existem para quem chama
        // se estiverem também no manifesto (ContainerRuntime.api.json).
        ListVolumeEntries              : containerRuntimeAdapterService.ListVolumeEntries,
        PutFileInVolume                : containerRuntimeAdapterService.PutFileInVolume,
        GetFileFromVolume              : containerRuntimeAdapterService.GetFileFromVolume,
        DeleteVolumeEntry              : containerRuntimeAdapterService.DeleteVolumeEntry,
        CreateNewContainer             : containerRuntimeAdapterService.CreateNewContainer,
        BuildImageFromDockerfileString : containerRuntimeAdapterService.BuildImageFromDockerfileString,
        RemoveContainer                : containerRuntimeAdapterService.RemoveContainer,
        StartContainer                 : containerRuntimeAdapterService.StartContainer,
        StopContainer                  : containerRuntimeAdapterService.StopContainer,
        RestartContainer               : containerRuntimeAdapterService.RestartContainer,
        KillContainer                  : containerRuntimeAdapterService.KillContainer,
        InspectContainer               : containerRuntimeAdapterService.InspectContainer,
        GetContainerLogHistory         : containerRuntimeAdapterService.GetContainerLogHistory,
        ExportContainer                : containerRuntimeAdapterService.ExportContainer,
        InspectNetwork                 : containerRuntimeAdapterService.InspectNetwork,
        CreateNewNetwork               : containerRuntimeAdapterService.CreateNewNetwork,
        RemoveNetwork                  : containerRuntimeAdapterService.RemoveNetwork,
        ConnectContainerToNetwork      : containerRuntimeAdapterService.ConnectContainerToNetwork,
        DisconnectContainerFromNetwork : containerRuntimeAdapterService.DisconnectContainerFromNetwork,
        InspectVolume                  : containerRuntimeAdapterService.InspectVolume,
        CreateNewVolume                : containerRuntimeAdapterService.CreateNewVolume,
        RemoveVolume                   : containerRuntimeAdapterService.RemoveVolume,
        InspectImage                   : containerRuntimeAdapterService.InspectImage,
        RemoveImage                    : containerRuntimeAdapterService.RemoveImage,
        ExportImage                    : containerRuntimeAdapterService.ExportImage,
        ExportVolume                   : containerRuntimeAdapterService.ExportVolume
    }

    return Object.freeze(controllerServiceObject)

}

module.exports = ContainerRuntimeController