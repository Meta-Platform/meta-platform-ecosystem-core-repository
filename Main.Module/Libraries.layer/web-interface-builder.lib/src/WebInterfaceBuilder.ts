import type { BuildProfile } from "./Types"

const path              = require("path") as typeof import("path")
const { promisify }     = require("util") as typeof import("util")
const fs                = require("fs") as typeof import("fs")
const exists            = promisify(fs.exists)

const BuildProfiles           = require("./BuildProfiles")
const CreateWebpackConfig     = require("./CreateWebpackConfig")
const CreateBuildWorkerClient = require("./CreateBuildWorkerClient")
const BuildCache              = require("./BuildCache")
const ResolveBuildEngine      = require("./ResolveBuildEngine")

const CheckPackageDirExist = (path: string) => exists(`${path}`)

const NormalizeComponentLibraries = CreateWebpackConfig.NormalizeComponentLibraries

// Onde o cache de compilação em desenvolvimento fica. Propositalmente FORA do
// diretório de assets: ali dentro ele entraria no fingerprint do build e seria
// servido como conteúdo estático.
const WEBPACK_CACHE_DIR = ".webpack-cache"

const MountCacheDirectory = ({ environmentPath, generatedDirName, serverAppName }: {
    environmentPath?: string
    generatedDirName?: string
    serverAppName?: string
}) => {
    if(!environmentPath || !generatedDirName) return undefined
    return path.join(environmentPath, generatedDirName, WEBPACK_CACHE_DIR, String(serverAppName || "default"))
}

// Debounce com cancelamento explícito. O `setTimeout` pendente ao fim de um
// build mantém viva a closure do callback de progresso — e, por tabela, tudo
// que ela alcança. Sem `Cancel`, cada build deixava um timer órfão.
const _Debounce = (func: (...args: any[]) => void, delay: number) => {
    let inDebounce: NodeJS.Timeout | undefined
    const debounced = function(this: any, ...args: any[]) {
        const context = this
        clearTimeout(inDebounce)
        inDebounce = setTimeout(() => func.apply(context, args), delay)
    }
    debounced.Cancel = () => {
        clearTimeout(inDebounce)
        inDebounce = undefined
    }
    return debounced
}

const FormatErrors = (errors: any[] = []): string =>
    errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n… e mais ${errors.length - 5} erro(s)` : "")

// Fábrica: recebe SmartRequire (resolve npm no ambiente do ecossistema) e devolve o
// WebInterfaceBuilder. Assim esta lib (ecosystem-core) não depende por caminho relativo
// do essential — o registry injeta SmartRequire (ver taskloader-registry.lib).
const CreateWebInterfaceBuilder = (SmartRequire: (moduleName: string) => any) => {

    // O MOTOR é resolvido por build — ele depende do que o pacote declara, e
    // fixá-lo na fábrica daria um motor só para o processo inteiro —, mas a
    // INSTÂNCIA é memoizada por nome.
    //
    // O motivo é o mesmo que fez o webpack sair do corpo da fábrica: um motor
    // guarda o bundler carregado, e recriá-lo a cada build refaria essa carga.
    // O `SmartRequire` é fixo por fábrica, então a instância pode ser
    // compartilhada sem que dois pacotes interfiram um no outro — o que é por
    // pacote é a SESSÃO, criada em cada build.
    const engines: Record<string, any> = {}

    const _GetEngine = (engineName: string) => {
        if(!engines[engineName]) engines[engineName] = ResolveBuildEngine({ engineName, SmartRequire })
        return engines[engineName]
    }

    const WebInterfaceBuilder = async (params: any): Promise<any> => {

        const {
            entrypoint,
            htmlTemplate,
            context,
            nodeModulesPath,
            output,
            url,
            serverAppName,
            onChangeProgress,
            componentLibraries,
            wasmModules,
            // Perfil de build. `isWatch` é o parâmetro legado dos 14 .webgui do
            // ecossistema e continua funcionando: mapeia para "debug-watch".
            buildProfile,
            isWatch,
            // Qual motor compila a interface. O webpack é o padrão e deixou de
            // ser a única opção — ver ResolveBuildEngine.
            buildEngine,
            buildOverrides,
            environmentPath,
            generatedDirName,
            // Roda o build num processo filho que morre ao terminar. Quem pede
            // isso é o hospedeiro de vida longa — hoje, a janela desktop.
            isolateBuild,
            paths
        } = params

        const profile = BuildProfiles.ResolveBuildProfile({
            profileName: buildProfile,
            isWatch,
            overrides: buildOverrides
        })

        // O NOME do motor é resolvido cedo — custa nada e não carrega módulo
        // nenhum — porque ele entra na assinatura do cache e viaja para o
        // worker. Nome desconhecido falha aqui, antes de qualquer trabalho.
        const engineName = ResolveBuildEngine.ResolveBuildEngineName({ engineName: buildEngine })

        const workerClient = CreateBuildWorkerClient({ smartRequire: SmartRequire })

        // Só isola quando pedido E quando há de fato um runtime para o filho.
        // Sem runtime, compilar no próprio processo é melhor do que não compilar.
        const _ShouldIsolate = () => {
            if(!isolateBuild) return false
            if(!BuildProfiles.ResolveIsolationFlag({ value: params.buildIsolated })) return false
            const runtime = workerClient.ResolveWorkerRuntime()
            if(runtime) return true
            Log.warn("WebInterfaceBuilder", `sem runtime para o worker de build; ${serverAppName} compila no próprio processo`)
            return false
        }

        // O que o filho precisa saber para compilar sozinho. Note que só viajam
        // dados — caminhos e valores primitivos. Handles e closures não
        // atravessam o canal, por construção.
        const _MountJob = () => ({
            buildProfile: profile.name,
            // O filho compila com o MESMO motor do pai. Deixar o worker resolver
            // por conta própria faria o build isolado e o build em processo
            // divergirem sem que nada acusasse.
            buildEngine: engineName,
            buildOverrides,
            reportProgress: !!onChangeProgress,
            smartRequirePath: (paths && paths.smartRequire) || process.env.META_SMART_REQUIRE_PATH,
            installGlobalLoggerPath: (paths && paths.installGlobalLogger) || process.env.META_INSTALL_GLOBAL_LOGGER_PATH,
            // O worker é um processo NOVO: o hook que faz o `require` enxergar
            // `.ts` não atravessa o spawn. Sem este caminho, tudo que o worker
            // carrega por caminho e que hoje é TypeScript (a logger.lib, por
            // exemplo) morre em MODULE_NOT_FOUND dentro de um catch — o build
            // segue, calado, sem logger.
            installTypeScriptResolutionPath:
                (paths && paths.installTypeScriptResolution) || process.env.META_INSTALL_TYPESCRIPT_RESOLUTION_PATH,
            params: {
                context, entrypoint, output, nodeModulesPath, htmlTemplate,
                serverAppName, url, componentLibraries, wasmModules,
                cacheDirectory: MountCacheDirectory({ environmentPath, generatedDirName, serverAppName }),
                buildDate: profile.stableBuildDate ? "" : new Date().toISOString()
            }
        })

        const _WorkerLog = (level: string, text: string) =>
            (Log as any)[level] ? (Log as any)[level]("webgui-build-worker", text) : Log.info("webgui-build-worker", text)

        // Assinatura das entradas do build. Calculada ANTES de compilar, e
        // válida depois — o diretório de saída não participa dela.
        const _ComputeFingerprint = () => {
            try {
                return BuildCache.ComputeWebInterfaceFingerprint({
                    context,
                    nodeModules: nodeModulesPath,
                    componentLibraries,
                    wasmModules,
                    buildProfile: profile.name,
                    buildEngine: engineName,
                    entrypoint,
                    htmlTemplate
                })
            } catch(error: any){
                // Sem assinatura não há cache — recompila, que é o comportamento
                // seguro. Um erro aqui nunca pode impedir a interface de subir.
                Log.warn("WebInterfaceBuilder", `não consegui assinar as entradas de ${serverAppName}: ${error.message}`)
                return null
            }
        }

        const _AfterBuild = (fingerprint?: string) => {
            if(fingerprint)
                BuildCache.WriteBuildManifest(output, { fingerprint, serverAppName, profileName: profile.name })

            // O nome do diretório de assets deriva da configuração, então mudar
            // porta, URL ou perfil abandona o diretório anterior. Sem esta
            // faxina, `.generated_data` só cresce.
            if(!profile.watch && environmentPath && generatedDirName){
                const removed = BuildCache.PurgeStaleWebInterfaceAssets({
                    generatedDirPath: path.join(environmentPath, generatedDirName),
                    keepDirNames: [output],
                    maxAgeDays: Number(params.assetsRetentionDays) > 0 ? Number(params.assetsRetentionDays) : undefined
                })
                if(removed.length)
                    Log.info("WebInterfaceBuilder", `removi ${removed.length} diretório(s) de assets órfãos`)
            }
        }

        const handleChangeProgress = _Debounce((_percentage: number) => {
            const percentage = parseInt(String(_percentage * 100))
            onChangeProgress && onChangeProgress(percentage)
        }, 10)

        // A SESSÃO do motor nasce sob demanda, junto com o primeiro Run/Watch.
        // Criá-la aqui faria toda instanciação do builder resolver um motor —
        // inclusive as que terminam em acerto de cache e nunca compilam nada.
        let session: any

        const _EnsureSession = () => {
            if(!session)
                session = _GetEngine(engineName).CreateSession({
                    params: {
                        context,
                        entrypoint,
                        output,
                        nodeModulesPath,
                        htmlTemplate,
                        serverAppName,
                        url,
                        onProgress: onChangeProgress ? handleChangeProgress : undefined,
                        componentLibraries,
                        wasmModules,
                        cacheDirectory: MountCacheDirectory({ environmentPath, generatedDirName, serverAppName }),
                        // Em release a data é estável para que o bundle seja
                        // reproduzível — pré-requisito de qualquer cache de conteúdo.
                        buildDate: profile.stableBuildDate ? "" : new Date().toISOString()
                    },
                    profile
                })
            return session
        }

        // Idempotente: pode ser chamado pelo `finally` de um build, pelo Stop da
        // task e por um encerramento de processo sem que a segunda chamada faça mal.
        const Close = async () => {
            handleChangeProgress.Cancel()
            if(!session) return
            const current = session
            session = undefined
            await current.Close()
        }

        const _AssertContextExists = async () => {
            if(await CheckPackageDirExist(context)) return
            throw new Error(`O pacote ${context} não foi encontrado`)
        }

        const Run = async () => {
            await _AssertContextExists()

            // Cache: se a assinatura das entradas bate com a do último build e
            // os artefatos estão no disco, não há o que compilar. Antes, só a
            // janela desktop tinha esse desvio — o endpoint HTTP recompilava do
            // zero a cada subida da instância.
            const fingerprint = _ComputeFingerprint()
            if(BuildCache.IsWebInterfaceFresh({ output, fingerprint })){
                Log.info("WebInterfaceBuilder", `A interface ${serverAppName} está atualizada — reaproveitando o build anterior`)
                return { output, summary: { ok: true, fromCache: true }, fromCache: true, profileName: profile.name }
            }

            // Por que não reaproveitou. Sem isto, um cache que nunca acerta é
            // indistinguível de um cache que não existe — e o sintoma (recompilar
            // sempre) é exatamente o mesmo.
            if(fingerprint){
                const previous = BuildCache.ReadBuildManifest(output)
                Log.info("WebInterfaceBuilder", previous
                    ? `build necessário para ${serverAppName}: assinatura ${fingerprint.slice(0, 12)} ≠ ${String(previous.fingerprint).slice(0, 12)} (versão ${previous.cacheVersion})`
                    : `build necessário para ${serverAppName}: sem build anterior em ${output}`)
            }

            Log.info("WebInterfaceBuilder", `Iniciando a construção da interface ${context}`)

            if(_ShouldIsolate()){
                // O build inteiro — grafo de módulos, cache de arquivos lidos,
                // minificação — acontece e desaparece com o processo filho. Este
                // processo nunca chega a alocar nada disso.
                //
                // Duas famílias de falha, e elas NÃO podem ter o mesmo destino:
                //
                // - o worker não subiu (runtime velho demais para o `.ts` do
                //   entry, `job` incompleto, IPC que nunca ficou pronto). É
                //   problema do MEIO, não do código do painel: compilar aqui
                //   ainda entrega a interface, gastando memória. Degradar é
                //   estritamente melhor do que deixar a interface em 404.
                // - o worker subiu e o webpack recusou o código. Aí o build
                //   falhou de verdade, e repetir no processo daria o mesmo erro
                //   gastando o dobro. Esse sobe.
                let isolatedSummary
                try {
                    isolatedSummary = await workerClient.RunBuildInWorker({
                        job: _MountJob(),
                        profile,
                        onProgress: onChangeProgress,
                        onLog: _WorkerLog
                    })
                } catch(error: any){
                    Log.warn("WebInterfaceBuilder",
                        `o worker de build de ${serverAppName} não completou (${error.message}); ` +
                        `compilando no próprio processo — a interface sobe, mas o pico fica neste heap`)
                }

                if(isolatedSummary){

                    if(!isolatedSummary.ok)
                        throw new Error(
                            `A interface ${serverAppName} não compilou (${isolatedSummary.errorCount} erro(s)):\n${FormatErrors(isolatedSummary.errors)}`
                        )

                    Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi construida com sucesso (processo isolado, pico de ${Math.round((isolatedSummary.peakRssBytes || 0) / 1048576)} MB)`)
                    _AfterBuild(fingerprint)
                    return { output, summary: isolatedSummary, fromCache: false, isolated: true, profileName: profile.name }
                }
            }

            try {
                const summary = await _EnsureSession().RunOnce()

                if(!summary.ok)
                    throw new Error(
                        `A interface ${serverAppName} não compilou (${summary.errorCount} erro(s)):\n${FormatErrors(summary.errors)}`
                    )

                Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi construida com sucesso`)
                _AfterBuild(fingerprint)
                return { output, summary, fromCache: false, profileName: profile.name }

            } finally {
                // Build de uma vez só: a sessão não serve para mais nada depois
                // daqui. Fechá-la no `finally` cobre também o caminho de erro, que
                // é justamente quando o resíduo passava despercebido.
                await Close()
            }
        }

        const Watch = async () => {
            if(_ShouldIsolate()){
                await _AssertContextExists()

                // Em watch o ganho é maior ainda: o compilador e o watcher vivem
                // no filho pelo tempo todo que a interface ficar no ar, e somem
                // por completo quando a task encerra.
                const handle = await workerClient.StartWatchWorker({
                    job: _MountJob(),
                    profile,
                    onProgress: onChangeProgress,
                    onRebuild: (summary: any) => Log.info("WebInterfaceBuilder", summary.ok
                        ? `A interface ${serverAppName} foi atualizada com sucesso`
                        : `A interface ${serverAppName} tem erros de compilação:\n${FormatErrors(summary.errors)}`),
                    onLog: _WorkerLog
                })

                return { output, summary: handle.summary, Close: handle.Close, pid: handle.pid, isolated: true }
            }

            return _WatchInProcess()
        }

        const _WatchInProcess = async () => {
            await _AssertContextExists()

            const { summary } = await _EnsureSession().StartWatch({
                onCycle: ({ summary: cycleSummary, error }: any) => {
                    if(error) return Log.error("WebInterfaceBuilder", error)
                    if(!cycleSummary.ok)
                        Log.error("WebInterfaceBuilder", `A interface ${serverAppName} tem erros de compilação:\n${FormatErrors(cycleSummary.errors)}`)
                    else
                        Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi atualizada com sucesso`)
                }
            })

            // O `Close` devolvido é o do builder, não o da sessão: só ele também
            // cancela o debounce do progresso.
            return { output, summary, Close, pid: null }
        }

        // `Build` deixa a escolha entre compilar uma vez e ficar observando com o
        // PERFIL, não com quem chama. Run/Watch continuam expostos para quem
        // precisa forçar um dos dois.
        const Build = () => profile.watch ? Watch() : Run()

        return { Run, Watch, Build, Close, profile }
    }

    // Os perfis viajam junto com o builder porque quem consome (os taskloaders,
    // o electron-main) recebe esta função por injeção e não pode usar require
    // relativo até esta lib.
    WebInterfaceBuilder.BuildProfiles = BuildProfiles

    return WebInterfaceBuilder
}

CreateWebInterfaceBuilder.NormalizeComponentLibraries = NormalizeComponentLibraries
CreateWebInterfaceBuilder.SummarizeStats = require("./BuildEngines/WebpackEngine").SummarizeStats
CreateWebInterfaceBuilder.BuildProfiles  = BuildProfiles

module.exports = CreateWebInterfaceBuilder
