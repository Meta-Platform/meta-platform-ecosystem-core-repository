const path              = require("path")
const { promisify }     = require("util")
const fs                = require("fs")
const exists            = promisify(fs.exists)

const CheckPackageDirExist = (path) => exists(`${path}`)

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
        onProgress
    }) => {
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
                modules: [ nodeModulesPath ]
            },
            resolveLoader:{
                modules: [ nodeModulesPath ]
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
                                    paths: {
                                        "*": [ `${nodeModulesPath}/*` ]
                                    },
                                    typeRoots: [ `${nodeModulesPath}/@types` ]
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
                        test: /\.(png|jpg|svg|gif|mp4|eot|glb|gltf)$/,
                        loader: "file-loader"
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
            loggerEmitter,
            onChangeProgress
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
            onProgress: handleChangeProgress
        })

        const Run = () => new Promise(async (resolve, reject) => {
            compiler.run(async (err, stats) => {
                const existDir = await CheckPackageDirExist(context)

                if(existDir){
                    loggerEmitter
                        && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"info", message:`Iniciando a construção da interface ${context}`})
                    try{
                        if(err) throw err
                        if(stats.compilation.errors.length > 0) throw stats.compilation.errors
                        loggerEmitter
                        && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"info", message:`A interface ${serverAppName} foi construido com sucesso`})
                        resolve(stats)
                    }catch(error){
                        console.log(error)
                        loggerEmitter
                        && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"error", message:error})
                    }
                } else {
                    loggerEmitter
                    && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"error", message:`O pacote ${context} não foi encontrado`})
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
                    loggerEmitter && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"error", message: err})
                    return
                }
                if (stats.hasErrors()) {
                    loggerEmitter && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"error", message: stats.compilation.errors})
                    return
                }
                loggerEmitter && loggerEmitter.emit("log", {sourceName: "WebInterfaceBuilder", type:"info", message: `A interface ${serverAppName} foi atualizada com sucesso`})
            })
        }

        return { Run, Watch }
    }

    return WebInterfaceBuilder
}

module.exports = CreateWebInterfaceBuilder
