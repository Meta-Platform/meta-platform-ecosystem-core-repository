const { describe, it } = require('node:test')
const assert = require('node:assert').strict

const BuildProfiles       = require("../src/BuildProfiles")
const CreateWebpackConfig = require("../src/CreateWebpackConfig")

const {
    ResolveBuildProfile,
    ResolveIsolationFlag,
    GetProfileFingerprintKey,
    MapLegacyIsWatch,
    RELEASE,
    DEBUG,
    DEBUG_WATCH
} = BuildProfiles

describe("BuildProfiles — resolução", () => {

    it("cai em release quando nada é declarado", () => {
        const profile = ResolveBuildProfile({ env: {} })
        assert.equal(profile.name, RELEASE)
        assert.equal(profile.mode, "production")
        assert.equal(profile.watch, false)
        assert.equal(profile.devtool, false)
        assert.equal(profile.minimize, true)
    })

    it("release não produz mapa de código nem aplica o source-map-loader", () => {
        const profile = ResolveBuildProfile({ profileName: RELEASE, env: {} })
        // Era o par mais caro da configuração antiga: source map completo mais
        // o loader lendo os mapas de todo o node_modules.
        assert.equal(profile.devtool, false)
        assert.equal(profile.applySourceMapLoader, false)
        assert.equal(profile.transpileOnly, false, "release mantém o typecheck")
    })

    it("debug troca custo de memória por diagnóstico", () => {
        const profile = ResolveBuildProfile({ profileName: DEBUG, env: {} })
        assert.equal(profile.mode, "development")
        assert.equal(profile.minimize, false)
        assert.equal(profile.transpileOnly, true)
        assert.equal(profile.cacheType, "filesystem")
        assert.equal(profile.watch, false)
    })

    it("debug-watch é o debug que fica observando", () => {
        const profile = ResolveBuildProfile({ profileName: DEBUG_WATCH, env: {} })
        assert.equal(profile.watch, true)
        assert.equal(profile.mode, "development")
    })

    it("o ambiente tem precedência sobre o parâmetro do pacote", () => {
        const profile = ResolveBuildProfile({
            profileName: DEBUG_WATCH,
            env: { META_WEBGUI_BUILD_PROFILE: RELEASE }
        })
        assert.equal(profile.name, RELEASE)
    })

    it("nome desconhecido não derruba nada: volta ao padrão", () => {
        // Um ecossistema instalado só recebe as chaves novas depois de um
        // update. Lançar aqui seria a diferença entre "o parâmetro não pegou" e
        // "nenhuma interface sobe".
        const warnings = []
        const previousLog = globalThis.Log
        globalThis.Log = { warn: (_, message) => warnings.push(message) }

        const profile = ResolveBuildProfile({ profileName: "turbo", env: {} })

        globalThis.Log = previousLog
        assert.equal(profile.name, RELEASE)
        assert.match(warnings.join(" "), /turbo/)
    })

    it("o perfil é imutável", () => {
        const profile = ResolveBuildProfile({ env: {} })
        // Fora de strict mode a atribuição não lança, só é ignorada — o que
        // importa é que ninguém consiga alterar o perfil por engano no meio de
        // um build. Overrides existem para isso e entram na resolução.
        profile.minimize = false
        assert.equal(profile.minimize, true)
        assert.equal(Object.isFrozen(profile), true)
    })

    it("overrides aplicam por cima do perfil", () => {
        const profile = ResolveBuildProfile({ profileName: RELEASE, overrides: { minimize: false }, env: {} })
        assert.equal(profile.minimize, false)
        assert.equal(profile.mode, "production")
    })
})

describe("BuildProfiles — o parâmetro legado isWatch", () => {

    it("isWatch true vira debug-watch, com aviso de obsolescência", () => {
        const warnings = []
        const previousLog = globalThis.Log
        globalThis.Log = { warn: (_, message) => warnings.push(message) }

        const profile = ResolveBuildProfile({ isWatch: true, env: {} })

        globalThis.Log = previousLog
        assert.equal(profile.name, DEBUG_WATCH)
        assert.match(warnings.join(" "), /obsoleto/)
    })

    it("só o booleano true conta — a string 'isWatch' não", () => {
        // GetPopulatedParameters resolve `isWatch: false` para a STRING "isWatch",
        // que é truthy. Tratar qualquer valor truthy como watch perpetuaria o
        // defeito de não conseguir desligar o watch.
        assert.equal(MapLegacyIsWatch("isWatch"), undefined)
        assert.equal(MapLegacyIsWatch(false), undefined)
        assert.equal(MapLegacyIsWatch("true"), undefined)
        assert.equal(MapLegacyIsWatch(true), DEBUG_WATCH)

        assert.equal(ResolveBuildProfile({ isWatch: "isWatch", env: {} }).name, RELEASE)
    })

    it("um perfil explícito ganha do isWatch legado", () => {
        const profile = ResolveBuildProfile({ profileName: RELEASE, isWatch: true, env: {} })
        assert.equal(profile.name, RELEASE)
        assert.equal(profile.watch, false)
    })
})

describe("BuildProfiles — bandeiras que precisam poder ser DESLIGADAS", () => {

    it("a string 'off' desliga o isolamento; ausência mantém ligado", () => {
        assert.equal(ResolveIsolationFlag({ value: "off", env: {} }), false)
        assert.equal(ResolveIsolationFlag({ value: "on",  env: {} }), true)
        assert.equal(ResolveIsolationFlag({ env: {} }), true)
        assert.equal(ResolveIsolationFlag({ value: "OFF", env: {} }), false)
    })

    it("o ambiente também desliga", () => {
        assert.equal(ResolveIsolationFlag({ value: "on", env: { META_WEBGUI_BUILD_ISOLATED: "off" } }), false)
    })

    it("o polling do watch é religável por variável de ambiente", () => {
        const withoutPoll = ResolveBuildProfile({ profileName: DEBUG_WATCH, env: {} })
        assert.equal(withoutPoll.watchPoll, false)

        const withPoll = ResolveBuildProfile({
            profileName: DEBUG_WATCH,
            env: { META_WEBGUI_BUILD_WATCH_POLL_MS: "1000" }
        })
        assert.equal(withPoll.watchPoll, 1000)
    })
})

describe("BuildProfiles — assinatura para o cache", () => {

    it("perfis diferentes têm assinaturas diferentes", () => {
        const keys = [RELEASE, DEBUG, DEBUG_WATCH]
            .map((name) => GetProfileFingerprintKey(ResolveBuildProfile({ profileName: name, env: {} })))

        // Sem isso, um build release reaproveitaria o artefato gordo de um
        // debug anterior no mesmo diretório.
        assert.equal(new Set([keys[0], keys[1]]).size, 2)
        assert.match(keys[0], /^release\|/)
    })
})

// ---------------------------------------------------------------------------

const FAKE_WEBPACK = Object.assign(() => {}, {
    DefinePlugin:   class { constructor(d){ this.d = d } },
    ProgressPlugin: class { constructor(h){ this.h = h } }
})
const FakeHtmlWebpackPlugin = class { constructor(o){ this.o = o } }

const BASE = {
    context:            "/pkg",
    entrypoint:         "index.tsx",
    output:             "/pkg/out",
    nodeModulesPath:    "/pkg/node_modules",
    htmlTemplate:       "index.html",
    serverAppName:      "app",
    url:                "",
    componentLibraries: [],
    buildDate:          ""
}

const _Config = (profileName, extra = {}) => CreateWebpackConfig({
    webpack: FAKE_WEBPACK,
    HtmlWebpackPlugin: FakeHtmlWebpackPlugin,
    params: { ...BASE, ...extra },
    profile: ResolveBuildProfile({ profileName, env: {} })
})

const _Rule = (config, test) => config.module.rules.find((rule) => String(rule.test) === String(test))

describe("CreateWebpackConfig — o perfil chega na configuração", () => {

    it("release: production, minificado, sem devtool", () => {
        const config = _Config(RELEASE)
        assert.equal(config.mode, "production")
        assert.equal(config.devtool, false)
        assert.equal(config.optimization.minimize, true)
        assert.equal(config.cache, false)
    })

    it("debug: development, sem minificar, com cache de filesystem", () => {
        const config = _Config(DEBUG, { cacheDirectory: "/tmp/cache" })
        assert.equal(config.mode, "development")
        assert.equal(config.optimization.minimize, false)
        assert.equal(config.devtool, "eval-cheap-module-source-map")
        assert.deepEqual(config.cache, { type: "filesystem", cacheDirectory: "/tmp/cache", name: DEBUG })
    })

    it("o source-map-loader some em release e exclui node_modules em debug", () => {
        assert.equal(_Rule(_Config(RELEASE), /\.js$/), undefined)

        const debugRule = _Rule(_Config(DEBUG), /\.js$/)
        assert.ok(debugRule, "debug precisa do loader para o código do próprio pacote")
        // Sem exclude, o loader lê e reparseia o mapa de código de todo o
        // node_modules — heap puro por um mapa que ninguém abre.
        assert.equal(String(debugRule.exclude), String(/node_modules/))
    })

    it("transpileOnly acompanha o perfil", () => {
        assert.equal(_Rule(_Config(RELEASE), /\.tsx?$/).use.options.transpileOnly, false)
        assert.equal(_Rule(_Config(DEBUG),   /\.tsx?$/).use.options.transpileOnly, true)
    })

    it("output.clean só fora do watch", () => {
        // Em watch o diretório está sendo servido: apagá-lo a cada recompilação
        // abriria uma janela de 404.
        assert.equal(_Config(RELEASE).output.clean, true)
        assert.equal(_Config(DEBUG_WATCH).output.clean, undefined)
    })

    it("o ProgressPlugin só entra quando há barra de progresso esperando", () => {
        const semBarra = _Config(RELEASE)
        assert.equal(semBarra.plugins.some((p) => p instanceof FAKE_WEBPACK.ProgressPlugin), false)

        const comBarra = _Config(RELEASE, { onProgress: () => {} })
        assert.equal(comBarra.plugins.some((p) => p instanceof FAKE_WEBPACK.ProgressPlugin), true)
    })

    it("preserva o que já funcionava: asset modules, aliases e resolução", () => {
        const config = _Config(RELEASE, {
            componentLibraries: [
                { alias: "@i-components", sourcePath: "/libs/i-components", framework: "react", nodeModulesPath: "/libs/nm" }
            ]
        })

        // A regra de asset/resource é o que faz os ícones do Semantic aparecerem.
        const assetRule = config.module.rules.find((rule) => rule.type === "asset/resource")
        assert.ok(assetRule)
        assert.match(String(assetRule.test), /woff2\?/)

        // React único: biblioteca compilada por fonte precisa reusar o runtime
        // do consumidor, senão os hooks quebram.
        assert.equal(config.resolve.alias["@i-components"], "/libs/i-components")
        assert.ok(config.resolve.alias.react.endsWith("/react"))
        assert.ok(config.resolve.modules.includes("/libs/nm"))
        assert.ok(config.resolveLoader.modules.includes("/libs/nm"))

        const tsRule = _Rule(config, /\.tsx?$/)
        assert.deepEqual(tsRule.use.options.compilerOptions.paths["@i-components"], ["/libs/i-components"])
    })

    it("é função pura: mesma entrada, mesma configuração", () => {
        assert.deepEqual(JSON.stringify(_Config(RELEASE)), JSON.stringify(_Config(RELEASE)))
    })
})
