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

const _Debounce = (func, delay) => {
    let inDebounce
    return function() {
        const context = this
        const args = arguments
        clearTimeout(inDebounce)
        inDebounce = setTimeout(() => func.apply(context, args), delay)
    }
}

// Fábrica: recebe SmartRequire (resolve npm no ambiente do ecossistema) e devolve o
// WebInterfaceBuilder. Assim esta lib (ecosystem-core) não depende por caminho relativo
// do essential — o registry injeta SmartRequire (ver taskloader-registry.lib).
const CreateWebInterfaceBuilder = (SmartRequire) => {

    const webpack           = SmartRequire("webpack")
    const HtmlWebpackPlugin  = SmartRequire("html-webpack-plugin")

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

        let percentage = 0

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


        const handleChangeProgress = _Debounce((_percentage, message, ...args) => {
            percentage = parseInt(_percentage*100)
            onChangeProgress && onChangeProgress(percentage)
        }, 10)

        const compiler = GetCompiler({
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

        const Run = () => new Promise(async (resolve, reject) => {
            compiler.run(async (err, stats) => {
                const existDir = await CheckPackageDirExist(context)

                if(existDir){
                        Log.info("WebInterfaceBuilder", `Iniciando a construção da interface ${context}`)
                    try{
                        if(err) throw err
                        if(stats.compilation.errors.length > 0) throw stats.compilation.errors
                        Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi construido com sucesso`)
                        resolve(stats)
                    }catch(error){
                        Log.error("WebInterfaceBuilder", error)
                    }
                } else {
                    Log.error("WebInterfaceBuilder", `O pacote ${context} não foi encontrado`)
                    reject()
                }
            })
        })

        const Watch = () => {
            const watchOptions = {
                ignored: /node_modules/,
                aggregateTimeout: 300,
                poll: 1000
            }

            compiler.watch(watchOptions, (err, stats) => {
                if (err) {
                    Log.error("WebInterfaceBuilder", err)
                    return
                }
                if (stats.hasErrors()) {
                    Log.error("WebInterfaceBuilder", stats.compilation.errors)
                    return
                }
                Log.info("WebInterfaceBuilder", `A interface ${serverAppName} foi atualizada com sucesso`)
            })
        }

        return { Run, Watch }
    }

    return WebInterfaceBuilder
}

CreateWebInterfaceBuilder.NormalizeComponentLibraries = NormalizeComponentLibraries

module.exports = CreateWebInterfaceBuilder
