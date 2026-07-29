const { join } = require("path")

const DIR_SUFFIX = "webInterfaceAssets"

const MountOutputDirPath = ({environmentPath, outputDirName, RT_ENV_GENERATED_DIR_NAME}) =>
    join(environmentPath, RT_ENV_GENERATED_DIR_NAME, `${outputDirName}.${DIR_SUFFIX}`)

const SerializeComponentLibraries = (componentLibraries = {}) =>
    Object.keys(componentLibraries).map((requestedAlias) => {
        const handle = componentLibraries[requestedAlias]
        const manifest = handle.getManifest()
        return {
            alias: requestedAlias || manifest.alias,
            sourcePath: handle.getSourcePath(),
            nodeModulesPath: handle.getNodeModulesPath(),
            framework: manifest.framework
        }
    })

// Fábrica: recebe runtimeDeps (ComputeObjectHash + WebInterfaceBuilder injetados pelo
// registry) e devolve o StartWebGraphicUserInterfaceService — sem require relativo até
// o essential nem até o WebInterfaceBuilder (que agora vive no ecosystem-core).
const CreateStartWebGraphicUserInterfaceService = (runtimeDeps) => {

    const { ComputeObjectHash, WebInterfaceBuilder } = runtimeDeps

    const StartWebGraphicUserInterfaceService = async ({
        loaderParams
    }) => {
        const {
            nodejsPackageHandler,
            url,
            entrypoint,
            htmlTemplate,
            serverEndpointStatus,
            serverName,
            RT_ENV_GENERATED_DIR_NAME,
            isWatch,
            componentLibraries
        } = loaderParams

        const context = nodejsPackageHandler.getSourcePath()
        const environmentPath = nodejsPackageHandler.getEnvironmentPath()
        const nodeModulesPath = nodejsPackageHandler.getNodeModulesPath()

        const outputDirName = ComputeObjectHash({
            url, entrypoint, htmlTemplate, serverEndpointStatus, serverName,
            context, environmentPath, nodeModulesPath
        })

        const output = MountOutputDirPath({
            environmentPath,
            outputDirName,
            RT_ENV_GENERATED_DIR_NAME
        })

        const builder = await WebInterfaceBuilder({
            entrypoint,
            htmlTemplate,
            nodeModulesPath,
            context,
            output,
            url : serverEndpointStatus,
            serverAppName : serverName,
            componentLibraries: SerializeComponentLibraries(componentLibraries),
            onChangeProgress : (percentage) => {
                if(percentage < 100){
                        Log.info("WebUserInterfacePackager", `BUILDING ${percentage}%`)
                }
            }
        })

        if(isWatch) await builder.Watch()
        else await builder.Run()

        return output
    }

    return StartWebGraphicUserInterfaceService
}

CreateStartWebGraphicUserInterfaceService.SerializeComponentLibraries = SerializeComponentLibraries

module.exports = CreateStartWebGraphicUserInterfaceService
