import type { BuildProfile } from "../Types"

const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

// O worker é um processo NOVO e carrega os irmãos por CAMINHO, não por módulo —
// o mesmo motivo pelo qual o BuildWorkerEntry faz isto: a resolução de `.ts` da
// plataforma pode não estar instalada quando este arquivo é lido lá.
const _RequireSibling = (name: string) => {
    const base = path.join(__dirname, "..", name)
    return require([`${base}.js`, `${base}.ts`].find((candidate) => fs.existsSync(candidate)) ?? base)
}

const CreateWebpackConfig = _RequireSibling("CreateWebpackConfig")

const MAX_MESSAGES = 200

const _Message = (entry: any): string =>
    typeof entry === "string" ? entry : (entry && (entry.message || String(entry))) || ""

// Reduz o `stats` do webpack a um resumo transportável.
//
// Por que existe: o objeto `stats` referencia a `Compilation` inteira — module
// graph, source maps, o conteúdo de todo arquivo lido. Devolvê-lo ao chamador
// transforma qualquer variável que o guarde numa âncora que impede a coleta do
// build inteiro. O resumo é `structuredClone`-able de propósito: é o mesmo
// formato que atravessa o IPC quando o build roda em processo separado.
//
// Esta função morava em DUAS cópias — uma aqui, outra no BuildWorkerEntry —, que
// é precisamente o que a interface de motor existe para acabar.
const SummarizeStats = (stats: any, { startedAtMs }: { startedAtMs?: number } = {}) => {

    if(!stats) return { ok: false, errorCount: 0, warningCount: 0, errors: [], warnings: [] }

    const compilation = stats.compilation || {}
    const errors      = compilation.errors   || []
    const warnings    = compilation.warnings || []
    const assets      = compilation.assets   || {}
    const assetNames: string[] = Object.keys(assets)

    const _Elapsed = () => {
        if(startedAtMs !== undefined) return Date.now() - startedAtMs
        return (compilation.endTime && compilation.startTime)
            ? compilation.endTime - compilation.startTime
            : undefined
    }

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
        elapsedMs:    _Elapsed()
    }
}

// Motor de build baseado em webpack.
//
// Ele é UM motor, não O motor: quem escolhe é `ResolveBuildEngine`, e o nome
// escolhido entra na assinatura do cache, porque artefatos de motores diferentes
// não podem se sobrescrever. Um motor novo precisa oferecer `name` e
// `CreateSession`, e a sessão precisa de `RunOnce`, `StartWatch` e `Close`.
//
// O contrato é deliberadamente de ALTO nível — "compile isto e me diga como
// foi" — e não "me devolva um compilador". Um contrato em torno do objeto
// compiler admitiria só bundlers com a API do webpack (o rspack entra assim,
// quase de graça) e fecharia a porta para estratégias de outra forma, como o
// esbuild, que roda o compilador num processo próprio.
const CreateWebpackEngine = (SmartRequire: (moduleName: string) => any) => {

    // Carregado sob demanda, nunca na montagem: o motor é resolvido no boot de
    // todo host de TaskExecutor, e um `.app` sem interface não pode pagar o
    // grafo de módulos do webpack por um build que nunca vai acontecer.
    let webpackModule: any
    let htmlWebpackPluginModule: any

    const _Load = () => {
        if(!webpackModule){
            webpackModule           = SmartRequire("webpack")
            htmlWebpackPluginModule = SmartRequire("html-webpack-plugin")
        }
        return { webpack: webpackModule, HtmlWebpackPlugin: htmlWebpackPluginModule }
    }

    const CreateSession = ({ params, profile }: { params: any, profile: BuildProfile }) => {

        let compiler: any
        let watching: any
        let isClosed = false

        // O compiler nasce junto com o primeiro RunOnce/StartWatch. Construí-lo
        // na sessão faria toda instanciação alocar um compilador — inclusive as
        // que terminam em acerto de cache e nunca compilam nada.
        const _EnsureCompiler = () => {
            if(!compiler){
                const { webpack, HtmlWebpackPlugin } = _Load()
                compiler = webpack(CreateWebpackConfig({ webpack, HtmlWebpackPlugin, params, profile }))
            }
            return compiler
        }

        const _CloseWatching = () => new Promise<void>((resolve) => {
            if(!watching) return resolve()
            const current = watching
            watching = undefined
            try { current.close(() => resolve()) } catch(error){ resolve() }
        })

        // `compiler.close()` é o que libera o CachedInputFileSystem — a estrutura
        // onde o webpack 5 guarda o conteúdo de CADA arquivo lido durante o
        // build, incluindo a árvore de node_modules. Sem esta chamada, um build
        // num processo de vida longa nunca devolve essa memória.
        const _CloseCompiler = () => new Promise<void>((resolve) => {
            if(!compiler) return resolve()
            const current = compiler
            compiler = undefined
            try { current.close(() => resolve()) } catch(error){ resolve() }
        })

        // Idempotente: pode ser chamado pelo `finally` de um build, pelo Stop da
        // task e por um encerramento de processo sem que a segunda chamada faça mal.
        const Close = async () => {
            if(isClosed) return
            isClosed = true
            await _CloseWatching()
            await _CloseCompiler()
        }

        // Compila uma vez. Rejeita SÓ em falha de infraestrutura; erro de
        // compilação volta como `summary.ok === false`, porque quem decide o que
        // fazer com código que não compila é o chamador, não o motor.
        const RunOnce = () => new Promise<any>((resolve, reject) => {
            const startedAtMs = Date.now()
            // Toda saída do callback ASSENTA a promise. Uma versão anterior
            // logava a exceção e não chamava resolve nem reject: a promise ficava
            // pendente para sempre, a instância parava em STARTING e a closure
            // segurava o compiler inteiro no heap.
            _EnsureCompiler().run((error: any, stats: any) => {
                if(error) return reject(error instanceof Error ? error : new Error(String(error)))
                resolve(SummarizeStats(stats, { startedAtMs }))
            })
        })

        // Observa. Resolve no PRIMEIRO ciclo, com ou sem erro de compilação: em
        // watch, erro de código é transitório — quem desenvolve corrige e o ciclo
        // seguinte conserta. `onCycle` recebe todo ciclo, inclusive o primeiro.
        const StartWatch = ({ onCycle }: { onCycle?: (event: any) => void } = {}) =>
            new Promise<any>((resolve, reject) => {

                const startedAtMs = Date.now()
                let hasSettled = false

                const watchOptions = {
                    ignored: /node_modules/,
                    aggregateTimeout: 300,
                    // O polling custa um stat de toda a árvore por ciclo. Fica
                    // desligado por padrão (o inotify dá conta) e só liga onde ele
                    // não funciona: volume montado, NFS, container.
                    poll: profile.watchPoll
                }

                // O objeto `Watching` é o ÚNICO handle capaz de parar o watcher.
                // Descartá-lo deixa o watcher vivo até o processo morrer, mesmo
                // depois do Stop da task.
                watching = _EnsureCompiler().watch(watchOptions, (error: any, stats: any) => {

                    if(error){
                        onCycle && onCycle({ error })
                        // Erro de infraestrutura no primeiro ciclo é fatal: não há
                        // bundle para servir e o watcher não vai se recuperar.
                        if(!hasSettled){
                            hasSettled = true
                            Close().finally(() => reject(error instanceof Error ? error : new Error(String(error))))
                        }
                        return
                    }

                    const summary = SummarizeStats(stats, { startedAtMs })
                    onCycle && onCycle({ summary, isFirst: !hasSettled })

                    if(!hasSettled){
                        hasSettled = true
                        resolve({ summary, Close })
                    }
                })
            })

        return { RunOnce, StartWatch, Close }
    }

    return { name: "webpack", SummarizeStats, CreateSession }
}

CreateWebpackEngine.SummarizeStats = SummarizeStats

module.exports = CreateWebpackEngine
