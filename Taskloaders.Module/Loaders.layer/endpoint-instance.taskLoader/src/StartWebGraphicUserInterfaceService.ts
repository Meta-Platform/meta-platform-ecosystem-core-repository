// O nome e a montagem do diretório de saída vêm de `WebInterfaceBuilder.OutputDirectory`
// (injetado por runtimeDeps) — não são mais calculados aqui. Ver o comentário
// sobre portabilidade em `OutputDirectory.ts`, no web-interface-builder.lib.

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

// Um `.wasmlib` atravessa para o bundle como CAMINHO do binário — e só. Do lado
// do navegador não há fonte a compilar nem node_modules a resolver: o mesmo
// artefato que o task loader instanciou no host é servido como asset.
const SerializeWasmModules = (wasmModules: Record<string, any> = {}) =>
    Object.keys(wasmModules).map((requestedAlias) => {
        const handle = wasmModules[requestedAlias]
        return {
            alias: requestedAlias || handle.getAlias(),
            binaryPath: handle.getBinaryPath()
        }
    })

// Fábrica: recebe runtimeDeps (WebInterfaceBuilder injetado pelo registry) e
// devolve o StartWebGraphicUserInterfaceService — sem require relativo até o
// essential nem até o WebInterfaceBuilder (que agora vive no ecosystem-core).
const CreateStartWebGraphicUserInterfaceService = (runtimeDeps: any) => {

    const { WebInterfaceBuilder, paths } = runtimeDeps

    // Os perfis vêm anexados ao builder injetado — esta lib vive noutro pacote e
    // não pode alcançá-los por require relativo. O objeto vazio cobre um
    // ecosystem-core anterior a este recurso: nesse caso o perfil não entra no
    // nome do diretório, que é exatamente o comportamento antigo.
    const BuildProfiles = WebInterfaceBuilder.BuildProfiles || {
        GetProfileFingerprintKey: () => undefined,
        ResolveBuildProfile: () => ({})
    }

    // Nomeia e monta o diretório de saída — a MESMA conta que um pré-build
    // (`PrebuildWebInterface.ts`, no web-interface-builder.lib) usa, para que
    // um artefato construído fora do ciclo de vida do serviço seja achado
    // aqui. Ao contrário de `BuildProfiles`/`BuildCache` logo abaixo, este NÃO
    // tem fallback: os dois módulos vivem no mesmo pacote e sempre viajam
    // juntos — não existe um "ecosystem-core anterior" que tenha um sem o outro.
    const { OutputDirectory } = WebInterfaceBuilder

    // BuildCache e a resolução do NOME do motor cobrem o modo "servir artefato
    // pronto" (ver `_TryServePrebuiltAssets`). Opcionais de propósito: um
    // ecosystem-core anterior a este recurso não os anexa ao builder injetado,
    // e sem eles o comportamento cai para o de sempre — compila toda vez que
    // o endpoint sobe.
    const { BuildCache, ResolveBuildEngineName } = WebInterfaceBuilder

    // Decide se o que já está em `output` pode ser servido sem compilar de
    // novo. Só entra em jogo fora de watch (watch sempre observa a partir do
    // zero) e quando BuildCache está disponível.
    //
    // Dois modos, com o padrão sendo o mais cauteloso:
    //
    // - revalidando (padrão): recalcula o fingerprint das entradas — a MESMA
    //   conta que um build de verdade faria — e só serve se bater com o
    //   manifesto gravado. É o certo em desenvolvimento, onde a árvore muda a
    //   cada `git checkout` e o fingerprint é a única forma de perceber isso.
    // - confiando (`trustPrebuiltAssets` / `META_WEBGUI_TRUST_PREBUILT`): pula
    //   o fingerprint por completo. Calculá-lo varre o node_modules INTEIRO
    //   por `stat` — custo de arranque que uma imagem imutável não recupera:
    //   o artefato já foi validado uma vez, no momento em que foi construído,
    //   e a imagem não muda depois disso. Só confere manifesto + arquivos.
    //
    // Em qualquer um dos dois, achar o artefato pronto pula o build INTEIRO:
    // nem o builder é instanciado, nem o motor é CARREGADO — só o NOME é
    // validado, e `ResolveBuildEngineName` não faz `require` de bundler nenhum.
    const _TryServePrebuiltAssets = ({
        output, context, nodeModulesPath, entrypoint, htmlTemplate,
        profile, buildEngine, componentLibraries, wasmModules, trustPrebuiltAssets, serverName
    }: any) => {

        if(!BuildCache || !ResolveBuildEngineName) return undefined
        if(profile.watch) return undefined

        const trust = BuildProfiles.ResolveTrustPrebuiltFlag
            ? BuildProfiles.ResolveTrustPrebuiltFlag({ value: trustPrebuiltAssets })
            : false

        if(trust){
            if(!BuildCache.HasPrebuiltWebInterfaceArtifacts({ output })) return undefined
        } else {
            const engineName = ResolveBuildEngineName({ engineName: buildEngine })
            const fingerprint = BuildCache.ComputeWebInterfaceFingerprint({
                context,
                nodeModules: nodeModulesPath,
                componentLibraries: SerializeComponentLibraries(componentLibraries),
                wasmModules: SerializeWasmModules(wasmModules),
                buildProfile: profile.name,
                buildEngine: engineName,
                entrypoint,
                htmlTemplate
            })
            if(!BuildCache.IsWebInterfaceFresh({ output, fingerprint })) return undefined
        }

        const manifest = BuildCache.ReadBuildManifest(output)
        const builtAt = (manifest && manifest.builtAt) || "data desconhecida"
        Log.info("WebUserInterfacePackager",
            `servindo interface pré-construída para ${serverName} — construída em ${builtAt}` +
            (trust ? " (sem revalidar a assinatura)" : "")
        )
        return { output, Close: async () => {} }
    }

    const StartWebGraphicUserInterfaceService = async ({
        loaderParams
    }: { loaderParams: any }) => {
        const {
            nodejsPackageHandler,
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
            // Isolamento do build. Mesmo caminho do perfil: `RT_WEBGUI_BUILD_ISOLATED`
            // vem do ecosystem-defaults e o pacote pode sobrepor por
            // `webguiBuildIsolated`. Quem tem a última palavra é a variável de
            // ambiente META_WEBGUI_BUILD_ISOLATED, dentro do ResolveIsolationFlag.
            webguiBuildIsolated,
            RT_WEBGUI_BUILD_ISOLATED,
            // Qual motor compila a interface. Mesma precedência do perfil, e o
            // padrão continua sendo o webpack — o pacote só declara quando quer
            // outro. Nome desconhecido falha no builder, e falha alto.
            webguiBuildEngine,
            RT_WEBGUI_BUILD_ENGINE,
            // Parâmetro legado dos 14 .webgui existentes; vira "debug-watch".
            isWatch,
            componentLibraries,
            wasmModules,
            // Serve o artefato já construído sem revalidar o fingerprint — ver
            // `_TryServePrebuiltAssets`. Padrão: revalidar (o comportamento de
            // sempre). "on"/"true" liga; qualquer outra coisa mantém o padrão —
            // e `META_WEBGUI_TRUST_PREBUILT` no ambiente vence os dois.
            trustPrebuiltAssets
        } = loaderParams

        const context = nodejsPackageHandler.getSourcePath()
        const environmentPath = nodejsPackageHandler.getEnvironmentPath()
        const nodeModulesPath = nodejsPackageHandler.getNodeModulesPath()

        const buildProfile = webguiBuildProfile || RT_WEBGUI_BUILD_PROFILE
        const buildEngine  = webguiBuildEngine  || RT_WEBGUI_BUILD_ENGINE

        const profile = BuildProfiles.ResolveBuildProfile({ profileName: buildProfile, isWatch })

        // O perfil entra no nome do diretório: assets de `release` e de `debug`
        // são artefatos diferentes e não podem se sobrescrever.
        const profileKey = BuildProfiles.GetProfileFingerprintKey(profile)

        // Nome PORTÁVEL: só o que descreve O QUE está sendo construído — app,
        // entrada, template, perfil, motor. `context`, `environmentPath` e
        // `nodeModulesPath` (caminhos ABSOLUTOS do host) ficaram de fora — ver
        // o comentário em `OutputDirectory.ts` (web-interface-builder.lib)
        // sobre o efeito colateral aceito: um build anterior, gravado sob o
        // hash antigo, fica órfão e o primeiro build depois desta mudança
        // acontece de novo, uma vez só. Dali em diante o mesmo pacote, em
        // qualquer máquina, aponta para o mesmo diretório — é o que permite
        // construir num lugar (uma imagem, outro módulo) e servir noutro.
        //
        // `url` e `serverEndpointStatus` também ficaram de fora — mesmo sem
        // amarrar a máquina (são portáveis: rota lógica e "localhost:PORTA"
        // fixos no metadado do pacote, não algo descoberto do socket real).
        // Achado, não corrigido aqui: `serverEndpointStatus` é baked no bundle
        // (vira `process.env.HTTP_SERVER_MANAGER_ENDPOINT` — ver
        // CreateWebpackConfig.ts) mas NUNCA entrou no fingerprint do
        // BuildCache, só no nome do diretório antigo. Antes, mudar a porta
        // criava um diretório novo e escondia essa lacuna; agora que o nome
        // não depende mais disso, um pacote que muda só de porta reaproveita o
        // diretório anterior e o cache o considera fresco — servindo um bundle
        // com o endereço do server-manager errado embutido. A correção certa é
        // acrescentar `serverEndpointStatus` ao fingerprint do BuildCache, não
        // devolvê-lo ao nome do diretório.
        const outputDirName = OutputDirectory.ComputeOutputDirName({
            serverAppName: serverName, entrypoint, htmlTemplate, profileKey, buildEngine
        })

        const output = OutputDirectory.MountOutputDirPath({
            environmentPath,
            outputDirName,
            generatedDirName: RT_ENV_GENERATED_DIR_NAME
        })

        // Artefato pronto? Serve e pula o build inteiro — nem o builder é
        // instanciado, nem o motor é carregado.
        const prebuilt = _TryServePrebuiltAssets({
            output, context, nodeModulesPath, entrypoint, htmlTemplate,
            profile, buildEngine, componentLibraries, wasmModules,
            trustPrebuiltAssets, serverName
        })
        if(prebuilt) return prebuilt

        const builder = await WebInterfaceBuilder({
            entrypoint,
            htmlTemplate,
            nodeModulesPath,
            context,
            output,
            url : serverEndpointStatus,
            serverAppName : serverName,
            componentLibraries: SerializeComponentLibraries(componentLibraries),
            wasmModules: SerializeWasmModules(wasmModules),
            buildProfile,
            buildEngine,
            isWatch,
            environmentPath,
            generatedDirName: RT_ENV_GENERATED_DIR_NAME,
            // O endpoint HTTP é hospedeiro de vida longa tanto quanto a janela
            // desktop: compilar dentro dele deixa o grafo de módulos do webpack
            // no heap do processo que depois serve o painel, e o V8 não devolve
            // esse pico ao sistema. Medido nos containers: um .webapp com
            // interface parava em ~273 MiB contra ~104 MiB de um .app sem ela.
            //
            // Pedir o isolamento não o impõe: o ResolveIsolationFlag ainda pode
            // desligá-lo (META_WEBGUI_BUILD_ISOLATED / RT_WEBGUI_BUILD_ISOLATED)
            // e, sem runtime para o filho, o builder avisa e compila aqui mesmo.
            isolateBuild: true,
            buildIsolated: webguiBuildIsolated !== undefined
                ? webguiBuildIsolated
                : RT_WEBGUI_BUILD_ISOLATED,
            // OBRIGATÓRIO junto do isolamento, e a omissão não perdoa: o worker
            // é um processo NOVO, e a primeira coisa que ele faz é
            // `require(job.smartRequirePath)`. Sem estes caminhos o job cai nas
            // variáveis META_*, que não existem no container, e o filho morre
            // antes de compilar — e o build isolado NÃO tem retorno ao caminho
            // em processo, então o erro sobe e a interface fica 404.
            paths,
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
CreateStartWebGraphicUserInterfaceService.SerializeWasmModules = SerializeWasmModules

module.exports = CreateStartWebGraphicUserInterfaceService
