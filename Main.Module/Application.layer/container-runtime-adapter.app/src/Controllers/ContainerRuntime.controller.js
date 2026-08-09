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
        /*
            Organizar e transferir em partes (VDRP-287/288/290). Valem os DOIS
            registros — esta lista e o manifesto: sem a linha aqui, o endpoint
            existe no manifesto e responde "o summary está indefinido"; sem a
            entrada no manifesto, nem endpoint há. Ter a operação implementada
            não basta, e foi assim que estas três ficaram escritas e
            inalcançáveis.
        */
        MakeVolumeDirectory            : containerRuntimeAdapterService.MakeVolumeDirectory,
        MoveVolumeEntry                : containerRuntimeAdapterService.MoveVolumeEntry,
        PutFileChunkInVolume           : containerRuntimeAdapterService.PutFileChunkInVolume,
        GetFileChunkFromVolume         : containerRuntimeAdapterService.GetFileChunkFromVolume,
        // Retomar envio interrompido e medir o volume (VDRP-292/294) — valem os
        // mesmos três registros: operação, esta linha e o manifesto.
        InspectVolumeUpload            : containerRuntimeAdapterService.InspectVolumeUpload,
        GetVolumeUsage                 : containerRuntimeAdapterService.GetVolumeUsage,
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