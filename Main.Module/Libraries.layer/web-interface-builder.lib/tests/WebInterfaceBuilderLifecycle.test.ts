const { describe, it, beforeEach } = require('node:test') as typeof import('node:test')
const assert = (require('node:assert') as typeof import('node:assert')).strict
const fs     = require('node:fs') as typeof import('node:fs')
const os     = require('node:os') as typeof import('node:os')
const path   = require('node:path') as typeof import('node:path')

const CreateWebInterfaceBuilder = require("../src/WebInterfaceBuilder")

// O builder loga pelo `globalThis.Log` que o ponto de entrada instala.
globalThis.Log = globalThis.Log || {
    info: () => {}, error: () => {}, warn: () => {}, message: () => {}
}

// Um contexto de pacote precisa EXISTIR: o builder recusa compilar um caminho
// que não está no disco (e é essa recusa que precisa rejeitar, não pendurar).
const EXISTING_CONTEXT = fs.mkdtempSync(path.join(os.tmpdir(), "wib-test-"))
const MISSING_CONTEXT  = path.join(EXISTING_CONTEXT, "nao-existe")

// Dublê do webpack. Registra o que foi chamado para que o teste possa afirmar
// sobre o CICLO DE VIDA (close/watch) sem compilar nada de verdade.
const CreateFakeWebpack = ({ runOutcome = "success", watchOutcome = "success" }: { runOutcome?: string, watchOutcome?: string } = {}) => {

    const calls = { compilerCount: 0, runCount: 0, watchCount: 0, closeCount: 0, watchingCloseCount: 0 }

    const _MakeStats = ({ errors = [] }: { errors?: any[] } = {}) => ({
        compilation: {
            errors,
            warnings: [],
            assets: { "bundle.js": { size: () => 1234 } },
            startTime: 0,
            endTime: 10
        },
        hasErrors: () => errors.length > 0
    })

    const _Emit = (outcome: string, callback: (error: Error | null, stats?: any) => void) => {
        // Assíncrono como o webpack real: o callback nunca roda no mesmo tick.
        setImmediate(() => {
            if(outcome === "fatal")           callback(new Error("falha de infraestrutura"), undefined)
            else if(outcome === "compile-error") callback(null, _MakeStats({ errors: ["erro de sintaxe em App.tsx"] }))
            else                               callback(null, _MakeStats())
        })
    }

    const webpack: any = () => {
        calls.compilerCount++
        return {
            run: (callback: any) => { calls.runCount++; _Emit(runOutcome, callback) },
            watch: (options: any, callback: any) => {
                calls.watchCount++
                assert.ok(options, "watch precisa receber watchOptions")
                _Emit(watchOutcome, callback)
                return { close: (done?: () => void) => { calls.watchingCloseCount++; done && done() } }
            },
            close: (done?: () => void) => { calls.closeCount++; done && done() }
        }
    }

    webpack.DefinePlugin   = class { constructor(definitions: any){ (this as any).definitions = definitions } }
    webpack.ProgressPlugin = class { constructor(handler: any){ (this as any).handler = handler } }

    return { webpack, calls }
}

const CreateBuilderWith = (fake: any, { requireLog }: { requireLog?: string[] } = {}) => {
    const FakeHtmlWebpackPlugin = class { constructor(options: any){ (this as any).options = options } }

    const SmartRequire = (moduleName: string) => {
        requireLog && requireLog.push(moduleName)
        if(moduleName === "webpack")            return fake.webpack
        if(moduleName === "html-webpack-plugin") return FakeHtmlWebpackPlugin
        throw new Error(`módulo inesperado: ${moduleName}`)
    }

    return CreateWebInterfaceBuilder(SmartRequire)
}

const BASE_PARAMS = {
    entrypoint:         "index.tsx",
    htmlTemplate:       "index.html",
    context:            EXISTING_CONTEXT,
    nodeModulesPath:    path.join(EXISTING_CONTEXT, "node_modules"),
    output:             path.join(EXISTING_CONTEXT, "out"),
    url:                "",
    serverAppName:      "pacote-de-teste",
    componentLibraries: []
}

describe("WebInterfaceBuilder — ciclo de vida", () => {

    let requireLog

    beforeEach(() => { requireLog = [] })

    it("não carrega o webpack ao montar a fábrica nem o builder", async () => {
        const fake = CreateFakeWebpack()
        const WebInterfaceBuilder = CreateBuilderWith(fake, { requireLog })

        // A fábrica é montada no BOOT de todo host de TaskExecutor. Se ela puxasse
        // o webpack, o daemon inteiro pagaria por um build que talvez nunca ocorra.
        assert.deepEqual(requireLog, [])

        await WebInterfaceBuilder({ ...BASE_PARAMS })
        assert.deepEqual(requireLog, [], "instanciar o builder também não deve carregar o webpack")
        assert.equal(fake.calls.compilerCount, 0)
    })

    it("carrega o webpack só no primeiro build, e uma vez só", async () => {
        const fake = CreateFakeWebpack()
        const WebInterfaceBuilder = CreateBuilderWith(fake, { requireLog })

        const first  = await WebInterfaceBuilder({ ...BASE_PARAMS })
        await first.Run()
        assert.deepEqual(requireLog, ["webpack", "html-webpack-plugin"])

        const second = await WebInterfaceBuilder({ ...BASE_PARAMS })
        await second.Run()
        assert.deepEqual(requireLog, ["webpack", "html-webpack-plugin"], "o módulo é memoizado")
    })

    it("fecha o compilador ao terminar um build bem-sucedido", async () => {
        const fake = CreateFakeWebpack()
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        const result = await builder.Run()

        assert.equal(result.fromCache, false)
        assert.equal(result.summary.ok, true)
        assert.equal(result.summary.assetCount, 1)
        // É `close()` que libera o CachedInputFileSystem do webpack 5.
        assert.equal(fake.calls.closeCount, 1)
    })

    it("fecha o compilador também quando o build falha", async () => {
        const fake = CreateFakeWebpack({ runOutcome: "compile-error" })
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        await assert.rejects(() => builder.Run(), /não compilou/)
        assert.equal(fake.calls.closeCount, 1, "o caminho de erro era o que mais deixava resíduo")
    })

    it("rejeita — nunca pendura — em erro fatal do webpack", async () => {
        const fake = CreateFakeWebpack({ runOutcome: "fatal" })
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        await assert.rejects(() => builder.Run(), /falha de infraestrutura/)
        assert.equal(fake.calls.closeCount, 1)
    })

    it("rejeita com Error quando o pacote não existe", async () => {
        const fake = CreateFakeWebpack()
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS, context: MISSING_CONTEXT })

        // Antes isto era `reject()` sem argumento, e o chamador registrava
        // "falha ao montar o endpoint undefined".
        await assert.rejects(() => builder.Run(), (error) =>
            error instanceof Error && /não foi encontrado/.test(error.message))

        assert.equal(fake.calls.compilerCount, 0, "nem chega a construir o compilador")
    })

    it("Watch resolve só depois do primeiro build e devolve um Close que funciona", async () => {
        const fake = CreateFakeWebpack()
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        const handle = await builder.Watch()

        // Se `Watch` resolvesse antes do primeiro ciclo, quem chama registraria o
        // diretório estático sem nenhum bundle dentro.
        assert.equal(fake.calls.watchCount, 1)
        assert.equal(handle.summary.ok, true)
        assert.equal(typeof handle.Close, "function")

        await handle.Close()
        assert.equal(fake.calls.watchingCloseCount, 1, "o watcher precisa parar")
        assert.equal(fake.calls.closeCount, 1, "e o compilador precisa fechar")
    })

    it("Watch tolera erro de compilação no primeiro ciclo (o watcher segue vivo)", async () => {
        const fake = CreateFakeWebpack({ watchOutcome: "compile-error" })
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        // Em desenvolvimento, erro de código é transitório: derrubar a instância
        // por causa dele obrigaria a subir tudo de novo a cada typo.
        const handle = await builder.Watch()
        assert.equal(handle.summary.ok, false)
        assert.equal(fake.calls.watchingCloseCount, 0)

        await handle.Close()
    })

    it("Watch rejeita em erro fatal, sem deixar o watcher para trás", async () => {
        const fake = CreateFakeWebpack({ watchOutcome: "fatal" })
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        await assert.rejects(() => builder.Watch(), /falha de infraestrutura/)
        assert.equal(fake.calls.closeCount, 1)
    })

    it("Close é idempotente", async () => {
        const fake = CreateFakeWebpack()
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        await builder.Run()
        await builder.Close()
        await builder.Close()

        // O Run já fechou; as chamadas seguintes não podem fechar de novo nem estourar.
        assert.equal(fake.calls.closeCount, 1)
    })

    it("o resumo do build não carrega o objeto stats do webpack", async () => {
        const fake = CreateFakeWebpack()
        const builder = await CreateBuilderWith(fake)({ ...BASE_PARAMS })

        const { summary } = await builder.Run()

        // `stats` referencia a Compilation inteira. Devolvê-lo ao chamador fazia
        // de qualquer variável que o guardasse uma âncora do build todo.
        assert.equal(summary.compilation, undefined)
        assert.deepEqual(Object.keys(summary).sort(), [
            "assetCount", "elapsedMs", "errorCount", "errors", "ok", "outputBytes", "warningCount", "warnings"
        ])
        // E precisa atravessar IPC quando o build sair para um processo separado.
        assert.doesNotThrow(() => structuredClone(summary))
    })
})
