const path = require("path")
const { readdir, readFile } = require("node:fs/promises")

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

const ExecutablesController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib
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

    const _ReadExecutable = async (executableName) => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const scriptContent = await readFile(path.resolve(executablesDirPath, executableName), "utf-8")
        return ParseExecutableScript(scriptContent)
    }

    const ListExecutables = async () => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const entries = await readdir(executablesDirPath, { withFileTypes: true })
        const executableNameList = entries
            .filter((entry) => !entry.isDirectory())
            .map((entry) => entry.name)

        const executableList = []
        for (const executableName of executableNameList) {
            try {
                const parsed = await _ReadExecutable(executableName)
                executableList.push({
                    executableName,
                    isDebug: executableName.endsWith("-dbg"),
                    ...parsed
                })
            } catch (e) {
                // ignora arquivos que não são executáveis válidos do ecossistema
            }
        }

        return executableList
    }

    const GetExecutableInformation = async (executableName) => {

        const parsed = await _ReadExecutable(executableName)
        const ecosystemDefaults = await _GetEcosystemDefaults()

        const metadataDirName = ecosystemDefaults.PKG_CONF_DIRNAME_METADATA
        const packageDirPath = path.resolve(parsed.repositoryPath, parsed.packageRepoPath)
        const metadataDirPath = path.resolve(packageDirPath, metadataDirName)

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
            ...parsed,
            packageDirPath,
            boot         : await _TryReadMetadata("boot.json"),
            package      : await _TryReadMetadata("package.json"),
            commandGroup : await _TryReadMetadata("command-group.json")
        }
    }

    return {
        controllerName : "ExecutablesController",
        ListExecutables,
        GetExecutableInformation
    }
}

module.exports = ExecutablesController
