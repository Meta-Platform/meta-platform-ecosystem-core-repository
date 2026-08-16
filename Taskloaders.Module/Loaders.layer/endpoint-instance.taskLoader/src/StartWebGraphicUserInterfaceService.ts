const { join } = require("path") as typeof import("path")

const DIR_SUFFIX = "webInterfaceAssets"

const MountOutputDirPath = ({environmentPath, outputDirName, RT_ENV_GENERATED_DIR_NAME}: {
    environmentPath: string
    outputDirName: string
    RT_ENV_GENERATED_DIR_NAME: string
}) =>
    join(environmentPath, RT_ENV_GENERATED_DIR_NAME, `${outputDirName}.${DIR_SUFFIX}`)

const SerializeComponentLibraries = (componentLibraries: Record<string, any> = {}) =>
    Object.keys(componentLibraries).map((requestedAlias) => {
        const handle = componentLibraries[requestedAlias]
        const manifest = handle.getManifest()
        return {
            alias: requestedAlias || manifest.alias,
            sourcePath: handle.getSourcePath(),
            nodeModulesPath: handle.getNodeModulesPath(),
            // Só a biblioteca que instalou o runtime do framework responde. A
            // guarda cobre um ecosystem-core anterior a este recurso: sem o
            // campo, o builder cai no comportamento antigo (react do consumidor).
            frameworkModulesPath: handle.getFrameworkModulesPath && handle.getFrameworkModulesPath(),
            framework: manifest.framework
        }
    })

// Fábrica: recebe runtimeDeps (ComputeObjectHash + WebInterfaceBuilder injetados pelo
// registry) e devolve o StartWebGraphicUserInterfaceService — sem require relativo até
// o essential nem até o WebInterfaceBuilder (que agora vive no ecosystem-core).
const CreateStartWebGraphicUserInterfaceService = (runtimeDeps: any) => {

    const { ComputeObjectHash, WebInterfaceBuilder } = runtimeDeps

    // Os perfis vêm anexados ao builder injetado — esta lib vive noutro pacote e
    // não pode alcançá-los por require relativo. O objeto vazio cobre um
    // ecosystem-core anterior a este recurso: nesse caso o perfil não entra no
    // nome do diretório, que é exatamente o comportamento antigo.
    const BuildProfiles = WebInterfaceBuilder.BuildProfiles || {
        GetProfileFingerprintKey: () => undefined,
        ResolveBuildProfile: () => ({})
    }

    const StartWebGraphicUserInterfaceService = async ({
        loaderParams
    }: { loaderParams: any }) => {
        const {
            nodejsPackageHandler,
            url,
            entrypoint,
            htmlTemplate,
            serverEndpointStatus,
            serverName,
            RT_ENV_GENERATED_DIR_NAME,
            // Perfil de build. `RT_WEBGUI_BUILD_PROFILE` chega do ecosystem-defaults,
            // que o gerador de parâmetros injeta em TODO endpoint — por isso nenhum
            // .webgui precisa declarar nada para herdar o padrão do ecossistema.
            webguiBuildProfile,
            RT_WEBGUI_BUILD_PROFILE,
            // Parâmetro legado dos 14 .webgui existentes; vira "debug-watch".
            isWatch,
            componentLibraries
        } = loaderParams

        const context = nodejsPackageHandler.getSourcePath()
        const environmentPath = nodejsPackageHandler.getEnvironmentPath()
        const nodeModulesPath = nodejsPackageHandler.getNodeModulesPath()

        const buildProfile = webguiBuildProfile || RT_WEBGUI_BUILD_PROFILE

        // O perfil entra no nome do diretório: assets de `release` e de `debug`
        // são artefatos diferentes e não podem se sobrescrever.
        const profileKey = BuildProfiles.GetProfileFingerprintKey(
            BuildProfiles.ResolveBuildProfile({ profileName: buildProfile, isWatch })
        )

        const outputDirName = ComputeObjectHash({
            url, entrypoint, htmlTemplate, serverEndpointStatus, serverName,
            context, environmentPath, nodeModulesPath, profileKey
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
            buildProfile,
            isWatch,
            environmentPath,
            generatedDirName: RT_ENV_GENERATED_DIR_NAME,
            onChangeProgress : (percentage: number) => {
                if(percentage < 100){
                        Log.info("WebUserInterfacePackager", `BUILDING ${percentage}%`)
                }
            }
        })

        Log.info("WebUserInterfacePackager", `perfil de build "${builder.profile.name}" para ${serverName}`)

        // `Build()` escolhe entre compilar uma vez e observar conforme o perfil.
        // Em watch ele só resolve depois do PRIMEIRO bundle ficar pronto, então
        // quem chama registra o diretório estático sabendo que há o que servir; e
        // o `Close` devolvido é o único jeito de parar o watcher.
        //
        // Em build de uma vez o compilador já se fecha sozinho, e o `Close`
        // inerte mantém a mesma forma de retorno para os dois caminhos.
        const result = await builder.Build()

        return { output, Close: result.Close || (async () => {}) }
    }

    return StartWebGraphicUserInterfaceService
}

CreateStartWebGraphicUserInterfaceService.SerializeComponentLibraries = SerializeComponentLibraries

module.exports = CreateStartWebGraphicUserInterfaceService
