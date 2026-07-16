const { join } = require("path")

const DIR_SUFFIX = "webInterfaceAssets"

const MountOutputDirPath = ({environmentPath, outputDirName, RT_ENV_GENERATED_DIR_NAME}) =>
    join(environmentPath, RT_ENV_GENERATED_DIR_NAME, `${outputDirName}.${DIR_SUFFIX}`)

// Fábrica: recebe runtimeDeps (ComputeObjectHash + WebInterfaceBuilder injetados pelo
// registry) e devolve o StartWebGraphicUserInterfaceService — sem require relativo até
// o essential nem até o WebInterfaceBuilder (que agora vive no ecosystem-core).
const CreateStartWebGraphicUserInterfaceService = (runtimeDeps) => {

    const { ComputeObjectHash, WebInterfaceBuilder } = runtimeDeps

    const StartWebGraphicUserInterfaceService = async ({
        loaderParams,
        loggerEmitter
    }) => {
        const {
            nodejsPackageHandler,
            url,
            entrypoint,
            htmlTemplate,
            serverEndpointStatus,
            serverName,
            RT_ENV_GENERATED_DIR_NAME,
            isWatch
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
            loggerEmitter,
            onChangeProgress : (percentage) => {
                if(percentage < 100){
                    loggerEmitter
                        && loggerEmitter.emit("log", {sourceName: "WebUserInterfacePackager", type:"info", message:`BUILDING ${percentage}%`})
                }
            }
        })

        if(isWatch) await builder.Watch()
        else await builder.Run()

        return output
    }

    return StartWebGraphicUserInterfaceService
}

module.exports = CreateStartWebGraphicUserInterfaceService
