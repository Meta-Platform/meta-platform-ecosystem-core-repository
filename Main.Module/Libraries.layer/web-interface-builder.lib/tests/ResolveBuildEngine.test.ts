const { describe, it } = require("node:test") as typeof import("node:test")
const assert = (require("node:assert") as typeof import("node:assert")).strict

const ResolveBuildEngine = require("../src/ResolveBuildEngine")
const BuildCache         = require("../src/BuildCache")

globalThis.Log = globalThis.Log || { info: () => {}, error: () => {}, warn: () => {}, message: () => {} }

const { ResolveBuildEngineName } = ResolveBuildEngine

describe("ResolveBuildEngine — qual motor compila a interface", () => {

    it("sem nada declarado, o padrão é o webpack", () => {
        assert.equal(ResolveBuildEngineName({ env: {} }), "webpack")
        assert.equal(ResolveBuildEngineName({ engineName: undefined, env: {} }), "webpack")
    })

    it("o nome declarado pelo pacote vence o padrão", () => {
        assert.equal(ResolveBuildEngineName({ engineName: "webpack", env: {} }), "webpack")
    })

    it("a variável de ambiente vence o pacote", () => {
        // Quem opera uma instalação precisa forçar o motor sem reprovisionar
        // todo mundo — a mesma precedência que o perfil de build já tem.
        assert.equal(
            ResolveBuildEngineName({ engineName: "inexistente", env: { META_WEBGUI_BUILD_ENGINE: "webpack" } }),
            "webpack"
        )
    })

    it("aceita o nome com espaços e em maiúsculas", () => {
        assert.equal(ResolveBuildEngineName({ engineName: "  WebPack ", env: {} }), "webpack")
    })

    it("string vazia é ausência, não erro", () => {
        assert.equal(ResolveBuildEngineName({ engineName: "   ", env: {} }), "webpack")
    })

    // Cair no padrão em silêncio faria um erro de digitação no metadado virar
    // "o motor novo não mudou nada", e a investigação começaria no lugar errado.
    it("nome desconhecido FALHA, e nomeia os conhecidos", () => {
        assert.throws(
            () => ResolveBuildEngineName({ engineName: "esbuild", env: {} }),
            (error: any) => /desconhecido: "esbuild"/.test(error.message) && /webpack/.test(error.message)
        )
    })

    it("o motor resolvido oferece o contrato que o builder usa", () => {
        const engine = ResolveBuildEngine({ engineName: "webpack", SmartRequire: () => ({}) })

        assert.equal(engine.name, "webpack")
        assert.equal(typeof engine.CreateSession, "function")

        // Resolver o motor NÃO pode carregar o bundler: o registro é consultado
        // no boot de todo host de TaskExecutor, e um pacote sem interface não
        // pode pagar o grafo de módulos do webpack por um build que nunca ocorre.
        const session = engine.CreateSession({ params: {}, profile: { name: "release" } as any })
        assert.equal(typeof session.RunOnce, "function")
        assert.equal(typeof session.StartWatch, "function")
        assert.equal(typeof session.Close, "function")
    })
})

describe("BuildCache — o motor entra na assinatura", () => {

    const BASE = { context: undefined, nodeModules: undefined, buildProfile: "release", entrypoint: "index.tsx" }

    it("motores diferentes produzem assinaturas diferentes", () => {
        // Sem isto, trocar de motor serviria o artefato do motor anterior como se
        // estivesse atualizado — e o build novo pareceria não ter efeito nenhum.
        const comWebpack = BuildCache.ComputeWebInterfaceFingerprint({ ...BASE, buildEngine: "webpack" })
        const comOutro   = BuildCache.ComputeWebInterfaceFingerprint({ ...BASE, buildEngine: "rspack" })

        assert.notEqual(comWebpack, comOutro)
    })

    it("o mesmo motor produz a mesma assinatura", () => {
        assert.equal(
            BuildCache.ComputeWebInterfaceFingerprint({ ...BASE, buildEngine: "webpack" }),
            BuildCache.ComputeWebInterfaceFingerprint({ ...BASE, buildEngine: "webpack" })
        )
    })
})
