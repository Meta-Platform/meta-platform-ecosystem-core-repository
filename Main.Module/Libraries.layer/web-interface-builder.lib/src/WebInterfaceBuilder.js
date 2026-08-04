const path              = require("path")
const { promisify }     = require("util")
const fs                = require("fs")
const exists            = promisify(fs.exists)

const BuildProfiles      = require("./BuildProfiles")
const CreateWebpackConfig = require("./CreateWebpackConfig")

const CheckPackageDirExist = (path) => exists(`${path}`)

const NormalizeComponentLibraries = CreateWebpackConfig.NormalizeComponentLibraries

// Onde o cache de compilação em desenvolvimento fica. Propositalmente FORA do
// diretório de assets: ali dentro ele entraria no fingerprint do build e seria
// servido como conteúdo estático.
const WEBPACK_CACHE_DIR = ".webpack-cache"

const MountCacheDirectory = ({ environmentPath, generatedDirName, serverAppName }) => {
    if(!environmentPath || !generatedDirName) return undefined
    return path.join(environmentPath, generatedDirName, WEBPACK_CACHE_DIR, String(serverAppName || "default"))
}

// Debounce com cancelamento explícito. O `setTimeout` pendente ao fim de um
// build mantém viva a closure do callback de progresso — e, por tabela, tudo
// que ela alcança. Sem `Cancel`, cada build deixava um timer órfão.
const _Debounce = (func, delay) => {
    let inDebounce
    const debounced = function() {
        const context = this
        const args = arguments
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

const SummarizeStats = (stats) => {
    if(!stats) return { ok: false, errorCount: 0, warningCount: 0, errors: [], warnings: [] }

    const compilation = stats.compilation
    const errors      = (compilation && compilation.errors)   || []
    const warnings    = (compilation && compilation.warnings) || []

    const _Message = (entry) =>
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
        outputBytes:  assetNames.reduce((total, name) => {
            const asset = assets[name]
            const size  = asset && typeof asset.size === "function" ? asset.size() : 0
            return total + (Number.isFinite(size) ? size : 0)
        }, 0),
        elapsedMs:    (compilation && compilation.endTime && compilation.startTime)
            ? compilation.endTime - compilation.startTime
            : undefined
    }
}

const FormatErrors = (errors = []) =>
    errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n… e mais ${errors.length - 5} erro(s)` : "")

// Fábrica: recebe SmartRequire (resolve npm no ambiente do ecossistema) e devolve o
// WebInterfaceBuilder. Assim esta lib (ecosystem-core) não depende por caminho relativo
// do essential — o registry injeta SmartRequire (ver taskloader-registry.lib).
const CreateWebInterfaceBuilder = (SmartRequire) => {

    // O webpack é carregado SOB DEMANDA, não na montagem da fábrica.
    //
    // Antes, `SmartRequire("webpack")` rodava aqui, no corpo da fábrica. Como o
    // taskloader-registry monta o mapa de loaders no boot de TODO host de
    // TaskExecutor (o daemon, cada `run package`, o processo do Electron), o
    // grafo de módulos do webpack — dezenas de MB — entrava no heap desses
    // processos mesmo quando nenhuma interface seria compilada. Um `.app` sem
    // webgui pagava o custo de um builder que nunca usaria.
    let webpackModule
    let htmlWebpackPluginModule

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
    const GetCompiler = (params, profile) => {
        const { webpack, HtmlWebpackPlugin } = _LoadWebpack()
        return webpack(CreateWebpackConfig({ webpack, HtmlWebpackPlugin, params, profile }))
    }

    const WebInterfaceBuilder = async (params) => {

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
            generatedDirName
        } = params

        const profile = BuildProfiles.ResolveBuildProfile({
            profileName: buildProfile,
            isWatch,
            overrides: buildOverrides
        })

        const handleChangeProgress = _Debounce((_percentage) => {
            const percentage = parseInt(_percentage * 100)
            onChangeProgress && onChangeProgress(percentage)
        }, 10)

        // O compiler nasce sob demanda, junto com o primeiro Run/Watch. Construí-lo
        // aqui faria toda instanciação do builder alocar um compiler — inclusive as
        // que terminam em cache hit e nunca compilam nada.
        let compiler
        let watching
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

        const _CloseWatching = () => new Promise((resolve) => {
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
        const _CloseCompiler = () => new Promise((resolve) => {
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

            Log.info("WebInterfaceBuilder", `Iniciando a construção da interface ${context}`)

            try {
                const summary = await new Promise((resolve, reject) => {
                    // Toda saída do callback ASSENTA a promise. A versão anterior
                    // logava a exceção e não chamava resolve nem reject: a promise
                    // ficava pendente para sempre, a instância parava em STARTING e
                    // a closure segurava o compiler inteiro no heap.
                    _EnsureCompiler().run((error, stats) => {
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
                return { output, summary, fromCache: false }

            } finally {
                // Build de uma vez só: o compiler não serve para mais nada depois
                // daqui. Fechá-lo no `finally` cobre também o caminho de erro, que
                // é justamente quando o resíduo passava despercebido.
                await Close()
            }
        }

        const Watch = () => new Promise((resolve, reject) => {
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
                    watching = _EnsureCompiler().watch(watchOptions, (error, stats) => {
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
                .catch((error) => {
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
