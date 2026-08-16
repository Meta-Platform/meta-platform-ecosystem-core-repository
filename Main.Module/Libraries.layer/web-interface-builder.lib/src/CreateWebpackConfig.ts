import type { BuildProfile, ComponentLibrary, WasmModule } from "./Types"

const path = require("path") as typeof import("path")

const NormalizeComponentLibraries = (componentLibraries: ComponentLibrary[] = []) =>
    componentLibraries.map((library: any) => {
        if (!library || !library.alias || !library.sourcePath)
            throw new Error("Biblioteca de UI inválida: alias e sourcePath são obrigatórios")
        return {
            alias: library.alias,
            sourcePath: path.resolve(library.sourcePath),
            framework: library.framework || "agnostic",
            nodeModulesPath: library.nodeModulesPath
                ? path.resolve(library.nodeModulesPath)
                : undefined,
            // Presente só na biblioteca que instalou o runtime do framework nas
            // próprias dependencies. Ausente nas que declaram em peerDependencies.
            frameworkModulesPath: library.frameworkModulesPath
                ? path.resolve(library.frameworkModulesPath)
                : undefined
        }
    })

// Um `.wasmlib` entra no bundle como ARQUIVO, não como código: o alias aponta
// para o `.wasm` e a regra de asset o emite, devolvendo a URL. É por isso que
// não há `sourcePath` aqui — do lado do navegador não existe fonte a compilar,
// existe um binário a buscar e instanciar:
//
//     import wasmUrl from "@wasm-reference"
//     const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl))
//
// O MESMO binário que o task loader instancia no host é o que chega aqui — não
// há uma build para o servidor e outra para o cliente.
const NormalizeWasmModules = (wasmModules: WasmModule[] = []) =>
    wasmModules.map((wasmModule) => {
        if (!wasmModule || !wasmModule.alias || !wasmModule.binaryPath)
            throw new Error("Módulo WebAssembly inválido: alias e binaryPath são obrigatórios")
        return {
            alias: wasmModule.alias,
            binaryPath: path.resolve(wasmModule.binaryPath)
        }
    })

// Monta a configuração do webpack a partir dos parâmetros do pacote e do perfil
// de build. Função PURA: não instancia compilador, não toca no disco. É o que
// permite testar a configuração sem ter o webpack instalado.
//
// `webpack` e `HtmlWebpackPlugin` chegam por parâmetro justamente para manter
// essa pureza — quem os carrega é o chamador, e só quando vai mesmo compilar.
const CreateWebpackConfig = ({
    webpack,
    HtmlWebpackPlugin,
    params,
    profile
}: {
    webpack: any
    HtmlWebpackPlugin: any
    params: any
    profile: BuildProfile
}): any => {

    const {
        context,
        entrypoint,
        output,
        nodeModulesPath,
        htmlTemplate,
        serverAppName,
        url,
        onProgress,
        componentLibraries,
        wasmModules,
        cacheDirectory,
        buildDate
    } = params

    const libraries = NormalizeComponentLibraries(componentLibraries)
    const wasmAliases = NormalizeWasmModules(wasmModules).reduce((result: Record<string, string>, { alias, binaryPath }) => {
        result[alias] = binaryPath
        return result
    }, {})
    const libraryNodeModules = libraries
        .map(({ nodeModulesPath }) => nodeModulesPath)
        .filter(Boolean)
    const aliases = libraries.reduce((result: Record<string, string>, { alias, sourcePath }) => {
        result[alias] = sourcePath
        return result
    }, {})
    // UM React por bundle. A raiz do runtime é a da PRIMEIRA biblioteca que
    // declara o framework nas próprias dependencies; se nenhuma declarar, cai no
    // node_modules do consumidor (comportamento anterior a este recurso).
    //
    // O alias vale para TODO módulo do grafo, inclusive os de dentro de
    // node_modules — é o que impede que uma cópia duplicada em disco (o npm
    // instala peers automaticamente para react-redux e react-router-dom) vire
    // uma segunda instância de React no bundle. Duas instâncias passam no build
    // e quebram só em execução, com "Invalid hook call".
    //
    // `react-dom` sem `$` faz prefix matching de propósito: `react-dom/client`,
    // usado em todo index.tsx, precisa resolver para a mesma raiz.
    const frameworkProvider = libraries.find(({ framework, frameworkModulesPath }) =>
        framework === "react" && frameworkModulesPath)
    const frameworkRoot = frameworkProvider
        ? frameworkProvider.frameworkModulesPath
        : nodeModulesPath
    const frameworkAliases = libraries.some(({ framework }) => framework === "react")
        ? {
            react: path.resolve(frameworkRoot, "react"),
            "react-dom": path.resolve(frameworkRoot, "react-dom")
        }
        : {}
    // Caminhos ABSOLUTOS não fazem o walk ancestral do Node: com só eles, um
    // node_modules ANINHADO — o que o npm cria quando há conflito de versão —
    // fica invisível ao webpack. A entrada relativa no fim devolve esse walk sem
    // mudar a precedência: o consumidor e as bibliotecas continuam vindo antes.
    const moduleSearchPaths = [ nodeModulesPath, ...libraryNodeModules, "node_modules" ]

    // O alias do webpack resolve o bundle, mas o ts-loader também precisa
    // conhecer a mesma topologia para typecheck de imports externos.
    const libraryTypeScriptPaths = libraries.reduce((result: Record<string, string[]>, { alias, sourcePath }) => {
        result[alias] = [sourcePath]
        result[`${alias}/*`] = [`${sourcePath}/*`]
        return result
    }, {})

    const rules: any[] = [
        {
            test: /\.tsx?$/,
            use: {
                loader: 'ts-loader',
                options: {
                    // transpileOnly descarta o ts.Program inteiro do TypeScript —
                    // o segundo maior consumidor de memória do build, depois do
                    // próprio grafo de módulos. Em desenvolvimento o editor já
                    // faz o typecheck; em release ele fica ligado, porque é o
                    // build que vira produto.
                    transpileOnly: profile.transpileOnly,
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
            // Binários (fontes, imagens, modelos 3D) via ASSET MODULES do webpack 5.
            // Antes isto usava file-loader e os ícones do Semantic ficavam invisíveis
            // em TODOS os WebGui, por dois defeitos encadeados:
            //   1. sem `type`, o webpack 5 tratava o arquivo como asset próprio e
            //      emitia o módulo JS do file-loader no lugar do binário — o
            //      Chromium recusava a fonte ("OTS parsing error: invalid sfntVersion");
            //   2. com esModule (padrão do file-loader), o css-loader interpolava o
            //      namespace do módulo e o CSS pedia `url([object Module])` → 404.
            // `asset/resource` emite o binário e devolve a URL — resolve os dois.
            // `.wasm` entra aqui, e não no suporte nativo do webpack a
            // WebAssembly: aquele importa as funções do módulo como se fossem
            // exports de JavaScript, e com isso o webpack escolhe as importações
            // e o momento da instanciação. Como asset, quem instancia é o código
            // do pacote — mesmo import object, mesma memória, mesmas instâncias
            // descartáveis que existem do lado do host.
            test: /\.(png|jpg|svg|gif|mp4|eot|woff2?|ttf|glb|gltf|wasm)$/,
            type: "asset/resource"
        }
    ]

    // O source-map-loader lê e reparseia o mapa de código de CADA .js que
    // entra no bundle. Sem `exclude`, isso inclui o node_modules inteiro — puro
    // consumo de heap por um mapa que ninguém vai abrir. Em release a regra nem
    // é aplicada (não há mapa a produzir); em desenvolvimento ela vale só para
    // o código do próprio pacote.
    if(profile.applySourceMapLoader)
        rules.splice(rules.length - 1, 0, {
            enforce: "pre",
            test: /\.js$/,
            exclude: /node_modules/,
            loader: "source-map-loader"
        })

    const plugins = [
        // hash: true anexa ?<hash-do-build> ao bundle no HTML gerado — cache-busting
        new HtmlWebpackPlugin({ template: path.resolve(context, htmlTemplate), hash: true }),
        new webpack.DefinePlugin({
            "process.env.HTTP_SERVER_MANAGER_ENDPOINT": JSON.stringify(url),
            "process.env.SERVER_APP_NAME": JSON.stringify(serverAppName),
            "process.env.BUILD_DATE": JSON.stringify(buildDate)
        })
    ]

    // O ProgressPlugin instrumenta cada módulo processado. Num build sem
    // interface esperando a barra, é custo sem destino.
    if(onProgress) plugins.push(new webpack.ProgressPlugin(onProgress))

    const config: any = {
        mode: profile.mode,
        context,
        entry: path.resolve(context, entrypoint),
        output: {
            filename: "bundle.js",
            path: output,
            // Limpa artefatos do build anterior. Só faz sentido no build de uma
            // vez: em watch o diretório está sendo servido, e apagá-lo abriria
            // uma janela de 404 a cada recompilação.
            ...profile.watch ? {} : { clean: true }
        },
        devtool: profile.devtool,
        resolve: {
            extensions:[".ts", ".tsx", ".js", ".json"],
            modules: moduleSearchPaths,
            // Um único runtime React por bundle, vindo da biblioteca que o
            // declarou (ver frameworkAliases acima). Cópias duplicadas em disco
            // são inofensivas; duplicadas no bundle quebram os hooks.
            // Os aliases de `.wasmlib` vêm por último e apontam para um ARQUIVO,
            // não para um diretório de fontes — daí não participarem do
            // `libraryTypeScriptPaths` acima. Quem importa em TypeScript declara
            // o módulo (`declare module "@alias"`), como se faz para qualquer asset.
            alias: { ...frameworkAliases, ...aliases, ...wasmAliases }
        },
        resolveLoader:{
            modules: moduleSearchPaths
        },
        module: { rules },
        plugins,
        optimization: {
            minimize: profile.minimize,
            ...profile.minimize ? { minimizer: undefined } : {}
        },
        // Sem isto o webpack percorre os assets calculando tamanho só para
        // decidir se emite um aviso que ninguém lê.
        performance: { hints: false },
        stats: profile.statsPreset,
        infrastructureLogging: { level: "warn" }
    }

    // O cache de filesystem acelera muito a recompilação em desenvolvimento,
    // mas fica FORA do diretório de assets: se ficasse dentro, entraria no
    // fingerprint do cache de build e seria servido como conteúdo estático.
    if(profile.cacheType === "filesystem" && cacheDirectory){
        config.cache = {
            type: "filesystem",
            cacheDirectory,
            name: profile.name
        }
    } else if(profile.cacheType) {
        config.cache = { type: profile.cacheType }
    } else {
        config.cache = false
    }

    // `minimizer: undefined` deixaria o webpack sem minificador nenhum.
    if(config.optimization.minimizer === undefined) delete config.optimization.minimizer

    return config
}

CreateWebpackConfig.NormalizeComponentLibraries = NormalizeComponentLibraries
CreateWebpackConfig.NormalizeWasmModules = NormalizeWasmModules

module.exports = CreateWebpackConfig
