import type { BuildProfile } from "./Types"

const path              = require("path") as typeof import("path")
const { promisify }     = require("util") as typeof import("util")
const fs                = require("fs") as typeof import("fs")
const exists            = promisify(fs.exists)

const BuildProfiles           = require("./BuildProfiles")
const CreateWebpackConfig     = require("./CreateWebpackConfig")
const CreateBuildWorkerClient = require("./CreateBuildWorkerClient")
const BuildCache              = require("./BuildCache")

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

// Reduz o `stats` do webpack a um resumo transportável.
//
// Por que isto existe: o objeto `stats` referencia a `Compilation` inteira —
// module graph, source maps, o conteúdo de todo arquivo lido. Devolvê-lo ao
// chamador (era o que `Run()` fazia) transforma qualquer variável que o guarde
// num âncora que impede a coleta do build inteiro. O resumo é `structuredClone`-
// able de propósito: é o mesmo formato que atravessa o IPC quando o build passa
// a rodar em processo separado.
const MAX_MESSAGES = 200

const SummarizeStats = (stats: any) => {
    if(!stats) return { ok: false, errorCount: 0, warningCount: 0, errors: [], warnings: [] }

    const compilation = stats.compilation
    const errors      = (compilation && compilation.errors)   || []
    const warnings    = (compilation && compilation.warnings) || []

    const _Message = (entry: any): string =>
        typeof entry === "string" ? entry : (entry && (entry.message || String(entry))) || ""

    const assets = (compilation && compilation.assets) || {}
    const assetNames = Object.keys(assets)

    return {
        ok:           errors.length === 0,
        errorCount:   errors.length,
        warningCount: warnings.length,
        errors:       errors.slice(0, MAX_MESSAGES).map(_Message),
        warnings:     warnings.slice(0, MAX_MESSAGES).map(_Message),
        assetCount:   assetNames.length,
        outputBytes:  assetNames.reduce((total: number, name: string) => {
            const asset = assets[name]
            const size  = asset && typeof asset.size === "function" ? asset.size() : 0
            return total + (Number.isFinite(size) ? size : 0)
        }, 0),
        elapsedMs:    (compilation && compilation.endTime && compilation.startTime)
            ? compilation.endTime - compilation.startTime
            : undefined
    }
}

const FormatErrors = (errors: any[] = []): string =>
    errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n… e mais ${errors.length - 5} erro(s)` : "")

// Fábrica: recebe SmartRequire (resolve npm no ambiente do ecossistema) e devolve o
// WebInterfaceBuilder. Assim esta lib (ecosystem-core) não depende por caminho relativo
// do essential — o registry injeta SmartRequire (ver taskloader-registry.lib).
const CreateWebInterfaceBuilder = (SmartRequire: (moduleName: string) => any) => {

    // O webpack é carregado SOB DEMANDA, não na montagem da fábrica.
    //
    // Antes, `SmartRequire("webpack")` rodava aqui, no corpo da fábrica. Como o
    // taskloader-registry monta o mapa de loaders no boot de TODO host de
    // TaskExecutor (o daemon, cada `run package`, o processo do Electron), o
    // grafo de módulos do webpack — dezenas de MB — entrava no heap desses
    // processos mesmo quando nenhuma interface seria compilada. Um `.app` sem
    // webgui pagava o custo de um builder que nunca usaria.
    let webpackModule: any
    let htmlWebpackPluginModule: any

    const _LoadWebpack = () => {
        if(!webpackModule){
            webpackModule          = SmartRequire("webpack")
            htmlWebpackPluginModule = SmartRequire("html-webpack-plugin")
        }
        return { webpack: webpackModule, HtmlWebpackPlugin: htmlWebpackPluginModule }
    }

    // Constrói o compilador para um build concreto. A configuração em si vive
    // em CreateWebpackConfig (função pura, testável sem webpack); aqui só
    // juntamos os módulos carregados sob demanda com os parâmetros e o perfil.
    const GetCompiler = (params: any, profile: BuildProfile) => {
        const { webpack, HtmlWebpackPlugin } = _LoadWebpack()
        return webpack(CreateWebpackConfig({ webpack, HtmlWebpackPlugin, params, profile }))
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
            // Perfil de build. `isWatch` é o parâmetro legado dos 14 .webgui do
            // ecossistema e continua funcionando: mapeia para "debug-watch".
            buildProfile,
            isWatch,
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
            buildOverrides,
            reportProgress: !!onChangeProgress,
            smartRequirePath: (paths && paths.smartRequire) || process.env.META_SMART_REQUIRE_PATH,
            installGlobalLoggerPath: (paths && paths.installGlobalLogger) || process.env.META_INSTALL_GLOBAL_LOGGER_PATH,
            params: {
                context, entrypoint, output, nodeModulesPath, htmlTemplate,
                serverAppName, url, componentLibraries,
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
                    buildProfile: profile.name,
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

        // O compiler nasce sob demanda, junto com o primeiro Run/Watch. Construí-lo
        // aqui faria toda instanciação do builder alocar um compiler — inclusive as
        // que terminam em cache hit e nunca compilam nada.
        let compiler: any
        let watching: any
        let isClosed = false

        const _EnsureCompiler = () => {
            if(!compiler)
                compiler = GetCompiler({
                    context,
                    entrypoint,
                    output,
                    nodeModulesPath,
                    htmlTemplate,
                    serverAppName,
                    url,
                    onProgress: onChangeProgress ? handleChangeProgress : undefined,
                    componentLibraries,
                    cacheDirectory: MountCacheDirectory({ environmentPath, generatedDirName, serverAppName }),
                    // Em release a data é estável para que o bundle seja
                    // reproduzível — pré-requisito de qualquer cache de conteúdo.
                    buildDate: profile.stableBuildDate ? "" : new Date().toISOString()
                }, profile)
            return compiler
        }

        const _CloseWatching = () => new Promise<void>((resolve) => {
            if(!watching) return resolve()
            const current = watching
            watching = undefined
            try { current.close(() => resolve()) }
            catch(error){
                Log.error("WebInterfaceBuilder", `falha ao encerrar o watcher de ${serverAppName}`, error)
                resolve()
            }
        })

        // `compiler.close()` é o que libera o CachedInputFileSystem — a estrutura
        // onde o webpack 5 guarda o conteúdo de CADA arquivo lido durante o build,
        // incluindo a árvore de node_modules. Sem esta chamada, um build num
        // processo de vida longa nunca devolve essa memória.
        const _CloseCompiler = () => new Promise<void>((resolve) => {
            if(!compiler) return resolve()
            const current = compiler
            compiler = undefined
            try { current.close(() => resolve()) }
            catch(error){
                Log.error("WebInterfaceBuilder", `falha ao encerrar o compilador de ${serverAppName}`, error)
                resolve()
            }
        })

        // Idempotente: pode ser chamado pelo `finally` de um build, pelo Stop da
        // task e por um encerramento de processo sem que a segunda chamada faça mal.
        const Close = async () => {
            if(isClosed) return
            isClosed = true
            handleChangeProgress.Cancel()
            await _CloseWatching()
            await _CloseCompiler()
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
                const summary = await workerClient.RunBuildInWorker({
                    job: _MountJob(),
                    profile,
                    onProgress: onChangeProgress,
                    onLog: _WorkerLog
                })

                if(!summary.ok)
                    throw new Error(
                        `A interface ${serverAppName} não compilou (${summary.errorCount} erro(s)):\n${FormatErrors(summary.errors)}`
                    )

                Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi construida com sucesso (processo isolado, pico de ${Math.round((summary.peakRssBytes || 0) / 1048576)} MB)`)
                _AfterBuild(fingerprint)
                return { output, summary, fromCache: false, isolated: true, profileName: profile.name }
            }

            try {
                const summary = await new Promise((resolve, reject) => {
                    // Toda saída do callback ASSENTA a promise. A versão anterior
                    // logava a exceção e não chamava resolve nem reject: a promise
                    // ficava pendente para sempre, a instância parava em STARTING e
                    // a closure segurava o compiler inteiro no heap.
                    _EnsureCompiler().run((error: any, stats: any) => {
                        if(error) return reject(error instanceof Error ? error : new Error(String(error)))

                        const result = SummarizeStats(stats)
                        if(!result.ok)
                            return reject(new Error(
                                `A interface ${serverAppName} não compilou (${result.errorCount} erro(s)):\n${FormatErrors(result.errors)}`
                            ))

                        resolve(result)
                    })
                })

                Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi construida com sucesso`)
                _AfterBuild(fingerprint)
                return { output, summary, fromCache: false, profileName: profile.name }

            } finally {
                // Build de uma vez só: o compiler não serve para mais nada depois
                // daqui. Fechá-lo no `finally` cobre também o caminho de erro, que
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

        const _WatchInProcess = () => new Promise<any>((resolve, reject) => {
            const watchOptions = {
                ignored: /node_modules/,
                aggregateTimeout: 300,
                // O polling custa um stat de toda a árvore por ciclo. Fica
                // desligado por padrão (o inotify dá conta) e só liga onde ele
                // não funciona: volume montado, NFS, container.
                poll: profile.watchPoll
            }

            let hasSettled = false

            _AssertContextExists()
                .then(() => {
                    // O objeto `Watching` é o ÚNICO handle capaz de parar o watcher.
                    // Antes ele era descartado, e o watcher (com polling de 1s sobre
                    // a árvore do pacote) ficava vivo até o processo morrer — mesmo
                    // depois do Stop da task.
                    watching = _EnsureCompiler().watch(watchOptions, (error: any, stats: any) => {
                        if(error){
                            Log.error("WebInterfaceBuilder", error)
                            // Erro de infraestrutura no primeiro ciclo é fatal: não há
                            // bundle para servir e o watcher não vai se recuperar.
                            if(!hasSettled){
                                hasSettled = true
                                Close().finally(() => reject(error instanceof Error ? error : new Error(String(error))))
                            }
                            return
                        }

                        const summary = SummarizeStats(stats)

                        if(!summary.ok)
                            Log.error("WebInterfaceBuilder", `A interface ${serverAppName} tem erros de compilação:\n${FormatErrors(summary.errors)}`)
                        else
                            Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi atualizada com sucesso`)

                        // Resolve no PRIMEIRO ciclo, com ou sem erro de compilação:
                        // em watch, erro de código é transitório — o desenvolvedor
                        // corrige e o próximo ciclo conserta. Antes, `Watch()` não
                        // devolvia promise alguma e quem chamava registrava o
                        // diretório estático antes de existir qualquer bundle nele.
                        if(!hasSettled){
                            hasSettled = true
                            resolve({ output, summary, Close, pid: null })
                        }
                    })
                })
                .catch((error: any) => {
                    if(hasSettled) return
                    hasSettled = true
                    Close().finally(() => reject(error))
                })
        })

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
CreateWebInterfaceBuilder.SummarizeStats = SummarizeStats
CreateWebInterfaceBuilder.BuildProfiles  = BuildProfiles

module.exports = CreateWebInterfaceBuilder
