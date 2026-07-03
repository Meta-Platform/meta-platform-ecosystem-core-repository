const path = require("path")
const { access, readdir, readFile } = require("node:fs/promises")

const PACKAGE_ICON_FILENAMES = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg", "icon.webp"]

const _ReadShellVariable = (scriptContent, variableName) => {
    const match = scriptContent.match(new RegExp(`^${variableName}="?([^"\\n]+)"?`, "m"))
    return match ? match[1] : undefined
}

const ParseExecutableScript = (scriptContent) => {
    const packageRepoPath      = _ReadShellVariable(scriptContent, "PACKAGE_REPO_PATH")
    const supervisorSocketPath = _ReadShellVariable(scriptContent, "SUPERVISOR_SOCKET_PATH")
    const repositoryPath       = _ReadShellVariable(scriptContent, "REPOSITORY_PATH")
    const isCommandLine        = /source\s+execute-command-line-application/.test(scriptContent)

    return {
        packageRepoPath,
        supervisorSocketPath,
        repositoryPath,
        type: isCommandLine ? "cli" : "application"
    }
}

const TypeFromApplicationType = (appType) => appType === "CLI" ? "cli" : "application"

const ExecutablesController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        notificationHubService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const _GetEcosystemDefaults = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        return ecosystemDefaults
    }

    const _GetExecutablesDirPath = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR)
    }

    const _GetRepositoriesData = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const repoDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA)
        return ReadJsonFile(repoDataFilePath)
    }

    const _TryReadJsonFile = async (filePath) => {
        try {
            return await ReadJsonFile(filePath)
        } catch(e) {
            return undefined
        }
    }

    const _ReadExecutable = async (executableName) => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const scriptContent = await readFile(path.resolve(executablesDirPath, executableName), "utf-8")
        return ParseExecutableScript(scriptContent)
    }

    const _GetPackageDirPath = (parsed) =>
        parsed.repositoryPath && parsed.packageRepoPath
            ? path.resolve(parsed.repositoryPath, parsed.packageRepoPath)
            : undefined

    const _FindPackageIconPath = async (packageDirPath) => {
        if(!packageDirPath) return undefined

        for (const iconFilename of PACKAGE_ICON_FILENAMES) {
            const iconPath = path.resolve(packageDirPath, iconFilename)
            try {
                await access(iconPath)
                return iconPath
            } catch (e) {}
        }

        return undefined
    }

    const _BuildExecutableFromScript = async (executableName) => {
        const parsed = await _ReadExecutable(executableName)
        const packageIconPath = await _FindPackageIconPath(_GetPackageDirPath(parsed))

        return {
            executableName,
            isDebug: executableName.endsWith("-dbg"),
            isInstalled: true,
            hasPackageIcon: Boolean(packageIconPath),
            ...parsed
        }
    }

    const _ListInstalledExecutables = async () => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const entries = await readdir(executablesDirPath, { withFileTypes: true })
        const executableNameList = entries
            .filter((entry) => !entry.isDirectory())
            .map((entry) => entry.name)

        const executableList = []
        for (const executableName of executableNameList) {
            try {
                executableList.push(await _BuildExecutableFromScript(executableName))
            } catch (e) {
                // ignora arquivos que não são executáveis válidos do ecossistema
            }
        }

        return executableList
    }

    const _ListDeclaredExecutables = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const repositoryNamespaceList = Object.keys(repositoriesData)
        const executableList = []

        for (const repositoryNamespace of repositoryNamespaceList) {
            const { installationPath } = repositoriesData[repositoryNamespace]
            if(!installationPath) continue

            const applications = await _TryReadJsonFile(path.resolve(installationPath, "metadata", "applications.json"))
            if(!Array.isArray(applications)) continue

            for (const application of applications) {
                const parsed = {
                    packageRepoPath: application.packageNamespace,
                    supervisorSocketFileName: application.supervisorSocketFileName,
                    repositoryPath: installationPath,
                    type: TypeFromApplicationType(application.appType)
                }
                const packageIconPath = await _FindPackageIconPath(_GetPackageDirPath(parsed))

                executableList.push({
                    executableName: application.executable,
                    isDebug: false,
                    isInstalled: false,
                    repositoryNamespace,
                    appType: application.appType,
                    hasPackageIcon: Boolean(packageIconPath),
                    ...parsed
                })
            }
        }

        return executableList
    }

    const ListExecutables = async () => {
        const installedExecutableList = await _ListInstalledExecutables()
        const installedByName = installedExecutableList
            .reduce((acc, executable) => ({ ...acc, [executable.executableName]: executable }), {})

        const declaredExecutableList = await _ListDeclaredExecutables()
        const declaredByName = declaredExecutableList
            .reduce((acc, executable) => ({ ...acc, [executable.executableName]: executable }), {})

        const declaredMergedList = declaredExecutableList.map((declaredExecutable) => ({
            ...declaredExecutable,
            ...(installedByName[declaredExecutable.executableName] || {})
        }))

        const installedOnlyList = installedExecutableList
            .filter((installedExecutable) => !declaredByName[installedExecutable.executableName])

        return [ ...declaredMergedList, ...installedOnlyList ]
    }

    const _ReadExecutableOrDeclared = async (executableName) => {
        const declaredExecutableList = await _ListDeclaredExecutables()
        const declaredExecutable = declaredExecutableList.find((executable) => executable.executableName === executableName)

        try {
            return {
                ...(declaredExecutable || {}),
                isInstalled: true,
                ...(await _ReadExecutable(executableName))
            }
        } catch(e) {
            if(declaredExecutable)
                return declaredExecutable
            throw e
        }
    }

    const GetExecutableInformation = async (executableName) => {

        const parsed = await _ReadExecutableOrDeclared(executableName)
        const ecosystemDefaults = await _GetEcosystemDefaults()

        const metadataDirName = ecosystemDefaults.PKG_CONF_DIRNAME_METADATA
        const packageDirPath = _GetPackageDirPath(parsed)
        const metadataDirPath = path.resolve(packageDirPath, metadataDirName)
        const packageIconPath = await _FindPackageIconPath(packageDirPath)

        const _TryReadMetadata = async (fileName) => {
            try {
                return await ReadJsonFile(path.resolve(metadataDirPath, fileName))
            } catch (e) {
                return undefined
            }
        }

        return {
            executableName,
            isDebug: executableName.endsWith("-dbg"),
            isInstalled: Boolean(parsed.isInstalled),
            ...parsed,
            packageDirPath,
            hasPackageIcon: Boolean(packageIconPath),
            boot         : await _TryReadMetadata("boot.json"),
            package      : await _TryReadMetadata("package.json"),
            commandGroup : await _TryReadMetadata("command-group.json"),
            startupParams: await _TryReadMetadata("startup-params.json")
        }
    }

    const GetExecutableIcon = async (executableName) => {
        const parsed = await _ReadExecutableOrDeclared(executableName)
        const packageIconPath = await _FindPackageIconPath(_GetPackageDirPath(parsed))
        if(!packageIconPath)
            throw new Error(`Icone do pacote associado ao executavel "${executableName}" nao encontrado.`)

        return packageIconPath
    }

    // Instala um executável DECLARADO (o repositório já está instalado; aqui só
    // criamos o script do executável no diretório global, via InstallApplication
    // — a mesma primitiva usada pelo `repo install --executables`).
    // Localiza InstallApplication: prefere a lib injetada no controller; se ela
    // não vier no bag do endpoint (a resolução de libs para controllers é
    // instável), faz fallback localizando a lib no filesystem via repositories.json.
    const _RequireInstallApplication = async () => {
        if(ecosystemInstallUtilitiesLib) {
            try { return ecosystemInstallUtilitiesLib.require("Install/InstallApplication") } catch(e) {}
        }
        const repositoriesData = await _GetRepositoriesData()
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const installationPath = repositoriesData[repositoryNamespace] && repositoriesData[repositoryNamespace].installationPath
            if(!installationPath) continue
            const candidate = path.join(installationPath, "Commons.Module", "Libraries.layer", "ecosystem-install-utilities.lib", "src", "Install", "InstallApplication.js")
            try {
                await access(candidate)
                return require(candidate)
            } catch(e) {}
        }
        throw new Error("ecosystem-install-utilities.lib (Install/InstallApplication) não encontrado em nenhum repositório instalado.")
    }

    const InstallExecutable = async (executableName) => {
        const declaredExecutableList = await _ListDeclaredExecutables()
        const declared = declaredExecutableList.find((executable) => executable.executableName === executableName)
        if(!declared)
            throw new Error(`Executável "${executableName}" não é declarado por nenhum repositório instalado.`)
        if(!declared.appType)
            throw new Error(`Executável "${executableName}" não declara appType (CLI/APP/DESKTOP).`)

        const ecosystemDefaults = await _GetEcosystemDefaults()
        const ecosystemDataPath = ecosystemdataHandlerService.GetEcosystemDataPath()
        const supervisorSocketDirPath = path.resolve(ecosystemDataPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)

        const InstallApplication = await _RequireInstallApplication()

        // encaminha os logs da instalação para as notificações do painel
        const loggerEmitter = {
            emit: (event, payload) => {
                if(event === "log" && notificationHubService && notificationHubService.NotifyEvent)
                    notificationHubService.NotifyEvent({ origin: "InstallExecutable", type: "log", content: payload })
            }
        }

        await InstallApplication({
            namespace: declared.repositoryNamespace,
            deployedRepoPath: declared.repositoryPath,
            applicationData: {
                appType: declared.appType,
                executable: declared.executableName,
                packageNamespace: declared.packageRepoPath,
                supervisorSocketFileName: declared.supervisorSocketFileName
            },
            installDataDirPath: ecosystemDataPath,
            ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR: ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR,
            REPOS_CONF_FILENAME_REPOS_DATA: ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA,
            supervisorSocketDirPath,
            loggerEmitter
        })

        return { installed: true, executableName }
    }

    return {
        controllerName : "ExecutablesController",
        ListExecutables,
        GetExecutableInformation,
        GetExecutableIcon,
        InstallExecutable
    }
}

module.exports = ExecutablesController
