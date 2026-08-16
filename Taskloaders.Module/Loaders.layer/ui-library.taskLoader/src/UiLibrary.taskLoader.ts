const fs = require("fs") as typeof import("fs")
const { join } = require("path") as typeof import("path")

// O nome do manifesto acompanha o nome do tipo de pacote: `.uilib` traz
// `metadata/uilib.json`.
const MANIFEST_PATH = join("metadata", "uilib.json")

const ReadManifest = (rootPath: string): any => {
    const manifestPath = join(rootPath, MANIFEST_PATH)
    if (!fs.existsSync(manifestPath))
        throw new Error(`Biblioteca de UI sem ${MANIFEST_PATH}: ${rootPath}`)

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    if (!manifest.alias || !manifest.source)
        throw new Error(`Manifesto de biblioteca de UI inválido em ${manifestPath}: alias e source são obrigatórios`)
    return manifest
}

const UiLibraryTaskLoader = ({ TaskStatusTypes, CommandChannelEventTypes }: any) =>
    (params: any, executorChannel: any) => {
        let libraryHandle: any

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

                // Qual biblioteca PROVÊ o runtime do framework. Só quem declara
                // react nas próprias dependencies responde; as demais declaram em
                // peerDependencies e não instalam nada. O builder usa isto para
                // apontar o alias `react` para UMA raiz só — duas instâncias de
                // React passam no build e quebram apenas em execução, com
                // "Invalid hook call" na primeira tela com estado.
                //
                // O stat é confiável aqui: o handle só é construído depois de a
                // task de install desta biblioteca emitir FINISHED (activationRules
                // em GenerateExecutionParamsForNodejsPackageServices).
                const _ResolveFrameworkModulesPath = () =>
                    fs.existsSync(join(nodeModulesPath, "react")) ? nodeModulesPath : undefined

                libraryHandle = Object.freeze({
                    getRootPath: () => rootPath,
                    getSourcePath: () => join(rootPath, manifest.source),
                    getEnvironmentPath: () => environmentPath,
                    getNodeModulesPath: () => nodeModulesPath,
                    getFrameworkModulesPath: _ResolveFrameworkModulesPath,
                    getManifest: () => ({ ...manifest })
                })
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
            } catch (error: any) {
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

module.exports = UiLibraryTaskLoader
