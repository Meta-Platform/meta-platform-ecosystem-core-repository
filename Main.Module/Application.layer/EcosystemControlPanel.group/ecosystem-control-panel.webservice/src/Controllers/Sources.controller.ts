const path = require("path")
const ExtractSourceListBySourcesData = (sourcesData: any) => {

    const repositoryNamespaceList = Object.keys(sourcesData)
    const sourceList = repositoryNamespaceList
    .reduce((acc: any[], repositoryNamespace) => {
        return [
            ...acc,
            ...sourcesData[repositoryNamespace]
                .map((sourceData: any) => ({
                    repositoryNamespace,
                    ...sourceData
                }))
        ]
    }, [])

    return sourceList
    
}

const ExtractActiveSourcesByRepoData = (repositoriesData: any) => {
    const installedRepositoriesList = Object.keys(repositoriesData)

    const installedApplicationsList = installedRepositoriesList
        .reduce((acc: any[], repositoryNamespace) => {

            const { sourceData } = repositoriesData[repositoryNamespace]

            return [
                ...acc,
                {
                    repositoryNamespace,
                    sourceData
                }
            ]
        }, [])


    return installedApplicationsList
}

const SourcesController = (params: any) => {
 
    const { 
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        notificationHubService
    } = params

    const { NotifyEvent } = notificationHubService

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")
    const UpdateRepository = ecosystemInstallUtilitiesLib.require("UpdateRepository")
    const InstallRepositoryLib = ecosystemInstallUtilitiesLib.require("InstallRepository")
    const ChangeRepositorySourceLib = ecosystemInstallUtilitiesLib.require("ChangeRepositorySource")

    // Cada operação de escrita reporta seu progresso pelo NotificationHub,
    // exatamente como o comando `repo` faz no terminal — assim a UI recebe os
    // mesmos logs em tempo real.
    // O NotificationHub segue existindo — ele é o barramento de eventos do
    // PAINEL, não o log do ecossistema — e passa a ser alimentado PELO logger:
    // durante a operação, um ouvinte encaminha cada registro para o hub.
    // Ver a decisão LOGS-32. O ouvinte é global enquanto está registrado, então
    // é removido no `finally`.
    const _WithLogNotification = async (origin: any, Executar: any) => {
        const RemoverOuvinte = Log.AddSink({
            Write : (record) => NotifyEvent({
                origin,
                type    : "log",
                content : { sourceName : record.source, type : record.level, message : record.message }
            })
        })
        try {
            return await Executar()
        } finally {
            RemoverOuvinte()
        }
    }

    const _NotifyStructured = ({ origin, type, title, message, data }: any) =>
        NotifyEvent({
            origin,
            type,
            content: { title, message, ...(data ? { data } : {}) }
        })

    const _ExtractSourceData = ({ repositoryNamespace, sourceType, sourcesData }: any) => {
        const sourcesList = sourcesData[repositoryNamespace] || []
        const sourceData = sourcesList.find((source: any) => source.sourceType === sourceType)
        if(!sourceData)
            throw `A fonte ${sourceType} não foi encontrada no repositório ${repositoryNamespace}`
        return sourceData
    }

    const _BuildSourceByType = ({ sourceType, localPath, repoName, repoOwner, fileId }: any) => {
        switch(sourceType){
            case "LOCAL_FS":
                return { sourceType, path: localPath }
            case "GITHUB_RELEASE":
                return { sourceType, repositoryName: repoName, repositoryOwner: repoOwner }
            case "GOOGLE_DRIVE":
                return { sourceType, fileId }
            default:
                throw `A fonte do tipo ${sourceType} não existe`
        }
    }

    const _GetEcosystemDefaults =  async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    const _ResolvePathWithEcosystemDataPath = async (paramName: any) => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults[paramName])
    }

    const _ReadConfigFile = async (paramName: any) => {
        const confFilePath = await _ResolvePathWithEcosystemDataPath(paramName)
        const configData = await ReadJsonFile(confFilePath)
        return configData
    }

    const _WriteConfigFile = async (paramName: any, configData: any) => {
        const confFilePath = await _ResolvePathWithEcosystemDataPath(paramName)
        await WriteObjectToFile(confFilePath, configData)
    }

    const ListSources = async () => {
        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const sourceList = ExtractSourceListBySourcesData(sourcesData)
        return sourceList
    }

    const ListActiveSources = async () => {
        const repositoriesData = await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA")
        const activeSourcesList = ExtractActiveSourcesByRepoData(repositoriesData)
        return activeSourcesList
    }

    const UpdateRepositoryByNamespace = async (repositoryNamespace: any) => {

        const repositoriesData = await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA")
        const {sourceData} = repositoriesData[repositoryNamespace]

        const ecosystemDefaults = await _GetEcosystemDefaults()

        await _WithLogNotification("SourcesController.UpdateRepository", () => UpdateRepository({
            repositoryNamespace,
            sourceData,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults
        }))

        _NotifyStructured({
            origin: "SourcesController.UpdateRepository",
            type: "package",
            title: "Pacotes atualizados",
            message: `Os pacotes do repositório ${repositoryNamespace} foram atualizados pela fonte ${sourceData.sourceType}.`,
            data: { repositoryNamespace, sourceType: sourceData.sourceType }
        })
    }

    const CreateNewRepositoryNamespace = async (repositoryNamespace: any) => {

        const sourceData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")

        if(sourceData[repositoryNamespace] === undefined){

            const newSourceData = {
                ...sourceData,
                [repositoryNamespace]: []
            }

            await _WriteConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA", newSourceData)
            _NotifyStructured({
                origin: "SourcesController.CreateNewRepositoryNamespace",
                type: "source",
                title: "Namespace criado",
                message: `Namespace ${repositoryNamespace} criado para cadastro de fontes.`,
                data: { repositoryNamespace }
            })

        } else {
            throw `O namespace ${repositoryNamespace} já esta cadastrado!`
        }
    }

    // Instala um repositório a partir de uma de suas fontes registradas.
    // Equivalente a `repo install [repositoryNamespace] [sourceType]`.
    const InstallRepository = async ({ repositoryNamespace, sourceType, executables }: any) => {

        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const sourceData = _ExtractSourceData({ repositoryNamespace, sourceType, sourcesData })

        const ecosystemDefaults = await _GetEcosystemDefaults()

        await _WithLogNotification("SourcesController.InstallRepository", () => InstallRepositoryLib({
            repositoryNamespace,
            sourceData,
            executablesToInstall: executables,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults
        }))

        _NotifyStructured({
            origin: "SourcesController.InstallRepository",
            type: "package",
            title: "Pacotes instalados",
            message: `Repositório ${repositoryNamespace} instalado pela fonte ${sourceType}.`,
            data: { repositoryNamespace, sourceType, executables }
        })
    }

    // Troca a fonte usada por um repositório já instalado.
    // Equivalente a `repo change installed source [repositoryNamespace] [sourceType]`.
    const ChangeRepositorySource = async ({ repositoryNamespace, sourceType }: any) => {

        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const sourceData = _ExtractSourceData({ repositoryNamespace, sourceType, sourcesData })

        const ecosystemDefaults = await _GetEcosystemDefaults()

        await _WithLogNotification("SourcesController.ChangeRepositorySource", () => ChangeRepositorySourceLib({
            repositoryNamespace,
            sourceData,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults
        }))

        _NotifyStructured({
            origin: "SourcesController.ChangeRepositorySource",
            type: "source",
            title: "Fonte ativa alterada",
            message: `Repositório ${repositoryNamespace} agora usa a fonte ${sourceType}.`,
            data: { repositoryNamespace, sourceType }
        })
    }

    // Registra uma nova fonte para um namespace.
    // Equivalente a `repo register source [repositoryNamespace] [sourceType]`.
    const RegisterNewSource = async (args: any) => {

        const { repositoryNamespace, sourceType } = args
        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")

        const alreadyRegistered = (sourcesData[repositoryNamespace] || [])
            .some((source: any) => source.sourceType === sourceType)

        if(alreadyRegistered)
            throw `Já existe uma fonte do tipo ${sourceType} para o repositório ${repositoryNamespace}`

        const newSourcesData = {
            ...sourcesData,
            [repositoryNamespace]: [
                ...(sourcesData[repositoryNamespace] || []),
                _BuildSourceByType(args)
            ]
        }

        await _WriteConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA", newSourcesData)

        _NotifyStructured({
            origin: "SourcesController.RegisterNewSource",
            type: "source",
            title: "Fonte registrada",
            message: `Fonte ${sourceType} registrada no namespace ${repositoryNamespace}.`,
            data: { repositoryNamespace, sourceType }
        })

        NotifyEvent({
            origin: "SourcesController.RegisterNewSource",
            type: "log",
            content: {
                sourceName: "RegisterNewSource",
                type: "warning",
                message: `Uma nova fonte do tipo ${sourceType} foi registrada no namespace ${repositoryNamespace}.`
            }
        })
    }

    // Remove uma fonte de um namespace.
    // Equivalente a `repo remove source [repositoryNamespace] [sourceType]`.
    const RemoveSource = async ({ repositoryNamespace, sourceType }: any) => {

        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")

        const registered = (sourcesData[repositoryNamespace] || [])
            .some((source: any) => source.sourceType === sourceType)

        if(!registered)
            throw `A fonte ${sourceType} não foi encontrada no repositório ${repositoryNamespace}`

        const newSourcesData = {
            ...sourcesData,
            [repositoryNamespace]: sourcesData[repositoryNamespace]
                .filter((source: any) => source.sourceType !== sourceType)
        }

        await _WriteConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA", newSourcesData)

        _NotifyStructured({
            origin: "SourcesController.RemoveSource",
            type: "source",
            title: "Fonte removida",
            message: `Fonte ${sourceType} removida do namespace ${repositoryNamespace}.`,
            data: { repositoryNamespace, sourceType }
        })

        NotifyEvent({
            origin: "SourcesController.RemoveSource",
            type: "log",
            content: {
                sourceName: "RemoveSource",
                type: "warning",
                message: `A fonte ${sourceType} foi removida do namespace ${repositoryNamespace}.`
            }
        })
    }

    return {
        controllerName : "SourcesController",
        ListSources,
        ListActiveSources,
        UpdateRepository: UpdateRepositoryByNamespace,
        CreateNewRepositoryNamespace,
        InstallRepository,
        ChangeRepositorySource,
        RegisterNewSource,
        RemoveSource
    }
}

module.exports = SourcesController
