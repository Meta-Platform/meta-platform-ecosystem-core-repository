const fs = require("fs")
const { join } = require("path")

const MANIFEST_PATH = join("metadata", "webgui-library.json")

const ReadManifest = (rootPath) => {
    const manifestPath = join(rootPath, MANIFEST_PATH)
    if (!fs.existsSync(manifestPath))
        throw new Error(`Pacote iComponents sem ${MANIFEST_PATH}: ${rootPath}`)

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    if (!manifest.alias || !manifest.source)
        throw new Error(`Manifesto iComponents inválido em ${manifestPath}: alias e source são obrigatórios`)
    return manifest
}

const WebGuiLibraryTaskLoader = ({ TaskStatusTypes, CommandChannelEventTypes }) =>
    (params, executorChannel) => {
        let libraryHandle

        const Start = () => {
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STARTING)
            try {
                const {
                    path: rootPath,
                    environmentPath,
                    tag,
                    EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES
                } = params
                const manifest = ReadManifest(rootPath)
                const nodeModulesPath = join(
                    environmentPath,
                    EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES,
                    String(tag).replace(/^@\//, ""),
                    "node_modules"
                )

                libraryHandle = Object.freeze({
                    getRootPath: () => rootPath,
                    getSourcePath: () => join(rootPath, manifest.source),
                    getEnvironmentPath: () => environmentPath,
                    getNodeModulesPath: () => nodeModulesPath,
                    getManifest: () => ({ ...manifest })
                })
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
            } catch (error) {
                libraryHandle = undefined
                executorChannel.emit(
                    CommandChannelEventTypes.CHANGE_TASK_STATUS,
                    TaskStatusTypes.FAILURE,
                    error.message
                )
            }
        }

        const Stop = () => {
            libraryHandle = undefined
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
        }

        executorChannel.on(CommandChannelEventTypes.START_TASK, Start)
        executorChannel.on(CommandChannelEventTypes.STOP_TASK, Stop)
        return () => libraryHandle
    }

module.exports = WebGuiLibraryTaskLoader
