const path              = require("path")
const { promisify }     = require("util")
const fs                = require("fs")
const exists            = promisify(fs.exists)

const CheckPackageDirExist = (path) => exists(`${path}`)

const NormalizeComponentLibraries = (componentLibraries = []) =>
    componentLibraries.map((library) => {
        if (!library || !library.alias || !library.sourcePath)
            throw new Error("Biblioteca iComponents inválida: alias e sourcePath são obrigatórios")
        return {
            alias: library.alias,
            sourcePath: path.resolve(library.sourcePath),
            framework: library.framework || "agnostic",
            nodeModulesPath: library.nodeModulesPath
                ? path.resolve(library.nodeModulesPath)
                : undefined
        }
    })

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

    const GetCompiler = ({
        context,
        entrypoint,
        output,
        nodeModulesPath,
        htmlTemplate,
        serverAppName,
        url,
        onProgress,
        componentLibraries
    }) => {
        const { webpack, HtmlWebpackPlugin } = _LoadWebpack()

        const libraries = NormalizeComponentLibraries(componentLibraries)
        const libraryNodeModules = libraries
            .map(({ nodeModulesPath }) => nodeModulesPath)
            .filter(Boolean)
        const aliases = libraries.reduce((result, { alias, sourcePath }) => {
            result[alias] = sourcePath
            return result
        }, {})
        const frameworkAliases = libraries.some(({ framework }) => framework === "react")
            ? {
                react: path.resolve(nodeModulesPath, "react"),
                "react-dom": path.resolve(nodeModulesPath, "react-dom")
            }
            : {}
        // O alias do webpack resolve o bundle, mas o ts-loader também precisa
        // conhecer a mesma topologia para typecheck de imports externos.
        const libraryTypeScriptPaths = libraries.reduce((result, { alias, sourcePath }) => {
            result[alias] = [sourcePath]
            result[`${alias}/*`] = [`${sourcePath}/*`]
            return result
        }, {})

        return webpack({
            context: context,
            entry: path.resolve(context, entrypoint),
            output: {
                filename: "bundle.js",
                path: output
            },
            devtool: "source-map",
            resolve: {
                extensions:[".ts", ".tsx", ".js", ".json"],
                modules: [ nodeModulesPath, ...libraryNodeModules ],
                // Bibliotecas compiladas por fonte devem reutilizar o runtime
                // React do consumidor. Isso evita hooks quebrados e cópias
                // duplicadas de React no mesmo WebGui.
                alias: { ...frameworkAliases, ...aliases }
            },
            resolveLoader:{
                modules: [ nodeModulesPath, ...libraryNodeModules ]
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        use: {
                            loader: 'ts-loader',
                            options: {
                                compilerOptions:{
                                    baseUrl: "./",
                                    skipLibCheck: true,
                                    paths: {
                                        "*": [
                                            `${nodeModulesPath}/*`,
                                            ...libraryNodeModules.map((modulesPath) => `${modulesPath}/*`)
                                        ],
                                        ...libraryTypeScriptPaths
                                    },
                                    typeRoots: [
                                        `${nodeModulesPath}/@types`,
                                        ...libraryNodeModules.map((modulesPath) => `${modulesPath}/@types`)
                                    ]
                                }
                            }
                        },
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.(scss|sass)$/,
                        use: [
                            "style-loader",
                            "css-loader",
                            "sass-loader",
                        ],
                    },
                    {
                        test: /\.css$/,
                        use: [
                            "style-loader",
                            "css-loader",
                        ],
                    },
                    {
                        enforce: "pre",
                        test: /\.js$/,
                        loader: "source-map-loader"
                    },
                    {
                        // Binários (fontes, imagens, modelos 3D) via ASSET MODULES do webpack 5.
                        // Antes isto usava file-loader e os ícones do Semantic ficavam invisíveis
                        // em TODOS os WebGui, por dois defeitos encadeados:
                        //   1. sem `type`, o webpack 5 tratava o arquivo como asset próprio e
                        //      emitia o módulo JS do file-loader no lugar do binário — o
                        //      Chromium recusava a fonte ("OTS parsing error: invalid sfntVersion");
                        //   2. com esModule (padrão do file-loader), o css-loader interpolava o
                        //      namespace do módulo e o CSS pedia `url([object Module])` → 404.
                        // `asset/resource` emite o binário e devolve a URL — resolve os dois.
                        test: /\.(png|jpg|svg|gif|mp4|eot|woff2?|ttf|glb|gltf)$/,
                        type: "asset/resource"
                    },
                ]
            },
            plugins:[
                // hash: true anexa ?<hash-do-build> ao bundle no HTML gerado — cache-busting
                new HtmlWebpackPlugin({template:path.resolve(context, htmlTemplate), hash: true}),
                new webpack.DefinePlugin({
                    "process.env.HTTP_SERVER_MANAGER_ENDPOINT": JSON.stringify(url),
                    "process.env.SERVER_APP_NAME": JSON.stringify(serverAppName),
                    "process.env.BUILD_DATE": JSON.stringify(new Date().toISOString())
                }),
                new webpack.ProgressPlugin(onProgress)
            ]
        })
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
            componentLibraries
        } = params

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
                    onProgress: handleChangeProgress,
                    componentLibraries
                })
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
                poll: 1000
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

        return { Run, Watch, Close }
    }

    return WebInterfaceBuilder
}

CreateWebInterfaceBuilder.NormalizeComponentLibraries = NormalizeComponentLibraries
CreateWebInterfaceBuilder.SummarizeStats = SummarizeStats

module.exports = CreateWebInterfaceBuilder
