const { describe, it } = require('node:test') as typeof import('node:test')
const assert = (require('node:assert') as typeof import('node:assert')).strict
const path   = require('node:path') as typeof import('node:path')

const CreateStartWebGraphicUserInterfaceService = require("../src/StartWebGraphicUserInterfaceService")

globalThis.Log = globalThis.Log || { info: () => {}, warn: () => {}, error: () => {}, message: () => {} }

// Dublê de `WebInterfaceBuilder` — a função (fábrica JÁ instanciada) que o
// registry injeta, com `.BuildProfiles`, `.BuildCache`, `.OutputDirectory` e
// `.ResolveBuildEngineName` pendurados nela (ver o fim de WebInterfaceBuilder.ts
// no web-interface-builder.lib). Não usa o webpack real: só precisa se
// comportar como o contrato exige para provar as DECISÕES deste arquivo —
// pular o build, revalidar ou confiar, cair para o build normal.
const _MakeFakeWebInterfaceBuilder = ({
    profile = { name: "release", watch: false },
    prebuilt = false,
    manifest = null,
    withBuildCache = true,
    buildCalls = { count: 0 },
    fingerprintCalls = { count: 0 }
}: any = {}) => {

    // `ComputeOutputDirName` real seria um hash; aqui basta ser DETERMINÍSTICO
    // nos mesmos campos e cego a qualquer outro — é exatamente a propriedade
    // que o teste de portabilidade quer provar.
    const OutputDirectory = {
        ComputeOutputDirName: ({ serverAppName, entrypoint, htmlTemplate, profileKey, buildEngine }: any) =>
            JSON.stringify({ serverAppName, entrypoint, htmlTemplate, profileKey, buildEngine }),
        MountOutputDirPath: ({ environmentPath, outputDirName, generatedDirName }: any) =>
            path.join(environmentPath, generatedDirName, `${outputDirName}.webInterfaceAssets`)
    }

    const BuildProfiles = {
        ResolveBuildProfile: () => profile,
        GetProfileFingerprintKey: () => "chave-de-perfil",
        ResolveTrustPrebuiltFlag: ({ value }: any) => value === "on"
    }

    const BuildCache = withBuildCache ? {
        HasPrebuiltWebInterfaceArtifacts: () => prebuilt,
        ComputeWebInterfaceFingerprint: () => { fingerprintCalls.count++; return "fp-fake" },
        IsWebInterfaceFresh: () => prebuilt,
        ReadBuildManifest: () => manifest
    } : undefined

    const ResolveBuildEngineName = withBuildCache
        ? ({ engineName }: any) => engineName || "webpack"
        : undefined

    const WebInterfaceBuilder: any = async (params: any) => {
        buildCalls.count++
        return {
            profile,
            Build: async () => ({ output: params.output, Close: undefined, summary: { ok: true } })
        }
    }
    WebInterfaceBuilder.BuildProfiles = BuildProfiles
    WebInterfaceBuilder.BuildCache = BuildCache
    WebInterfaceBuilder.OutputDirectory = OutputDirectory
    WebInterfaceBuilder.ResolveBuildEngineName = ResolveBuildEngineName

    return { WebInterfaceBuilder, buildCalls, fingerprintCalls }
}

const _MakeHandler = ({
    context = "/pkg",
    environmentPath = "/env",
    nodeModulesPath = "/pkg/node_modules"
}: any = {}) => ({
    getSourcePath: () => context,
    getEnvironmentPath: () => environmentPath,
    getNodeModulesPath: () => nodeModulesPath
})

const BASE_LOADER_PARAMS = {
    entrypoint: "index.tsx",
    htmlTemplate: "index.html",
    serverName: "meu-painel",
    serverEndpointStatus: "http://localhost:9999/server-manager/status",
    RT_ENV_GENERATED_DIR_NAME: ".generated_data",
    componentLibraries: {},
    wasmModules: {}
}

describe("StartWebGraphicUserInterfaceService — nome de diretório portável", () => {

    it("não muda quando só context/nodeModulesPath (caminhos absolutos) mudam", async () => {
        const { WebInterfaceBuilder } = _MakeFakeWebInterfaceBuilder()
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        const resultA = await Start({
            loaderParams: {
                ...BASE_LOADER_PARAMS,
                nodejsPackageHandler: _MakeHandler({ context: "/maquina-a/pkg", nodeModulesPath: "/maquina-a/pkg/node_modules" })
            }
        })
        const resultB = await Start({
            loaderParams: {
                ...BASE_LOADER_PARAMS,
                nodejsPackageHandler: _MakeHandler({ context: "/maquina-b/outro-checkout/pkg", nodeModulesPath: "/maquina-b/outro-checkout/pkg/node_modules" })
            }
        })

        // MESMO environmentPath nos dois — só o nome do ARTEFATO (a parte antes
        // de `.webInterfaceAssets`) precisa ser idêntico apesar do resto do
        // caminho do host divergir por completo.
        assert.equal(path.basename(resultA.output), path.basename(resultB.output))
    })

    it("muda quando o que descreve o artefato muda (app, entrada, perfil, motor)", async () => {
        const { WebInterfaceBuilder } = _MakeFakeWebInterfaceBuilder()
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        const base = await Start({ loaderParams: { ...BASE_LOADER_PARAMS, nodejsPackageHandler: _MakeHandler() } })
        const outroApp = await Start({
            loaderParams: { ...BASE_LOADER_PARAMS, serverName: "outro-painel", nodejsPackageHandler: _MakeHandler() }
        })

        assert.notEqual(path.basename(base.output), path.basename(outroApp.output))
    })
})

describe("StartWebGraphicUserInterfaceService — servir artefato pré-construído", () => {

    it("com artefato pronto, pula o build inteiro (revalidando o fingerprint por padrão)", async () => {
        const { WebInterfaceBuilder, buildCalls, fingerprintCalls } = _MakeFakeWebInterfaceBuilder({
            prebuilt: true,
            manifest: { builtAt: "2026-01-01T00:00:00.000Z" }
        })
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        const result = await Start({ loaderParams: { ...BASE_LOADER_PARAMS, nodejsPackageHandler: _MakeHandler() } })

        assert.equal(buildCalls.count, 0, "o builder não pode nem ser instanciado")
        assert.equal(fingerprintCalls.count, 1, "o padrão é revalidar — o fingerprint precisa ser calculado")
        assert.ok(result.output)
        assert.equal(typeof result.Close, "function")
    })

    it("trustPrebuiltAssets pula o build SEM calcular o fingerprint", async () => {
        const { WebInterfaceBuilder, buildCalls, fingerprintCalls } = _MakeFakeWebInterfaceBuilder({
            prebuilt: true,
            manifest: { builtAt: "2026-01-01T00:00:00.000Z" }
        })
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        await Start({
            loaderParams: { ...BASE_LOADER_PARAMS, trustPrebuiltAssets: "on", nodejsPackageHandler: _MakeHandler() }
        })

        assert.equal(buildCalls.count, 0)
        // A afirmação central do modo "confiar": nenhuma varredura de
        // node_modules por `stat` — é exatamente o custo que ele existe para evitar.
        assert.equal(fingerprintCalls.count, 0, "o modo de confiança não pode varrer o fingerprint")
    })

    it("sem artefato pronto, constrói normalmente — o comportamento de sempre", async () => {
        const { WebInterfaceBuilder, buildCalls } = _MakeFakeWebInterfaceBuilder({ prebuilt: false })
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        const result = await Start({ loaderParams: { ...BASE_LOADER_PARAMS, nodejsPackageHandler: _MakeHandler() } })

        assert.equal(buildCalls.count, 1)
        assert.ok(result.output)
    })

    it("trustPrebuiltAssets não serve nada se os artefatos não estiverem lá", async () => {
        // "on" liga o MODO, mas não inventa um artefato que não existe.
        const { WebInterfaceBuilder, buildCalls } = _MakeFakeWebInterfaceBuilder({ prebuilt: false })
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        await Start({
            loaderParams: { ...BASE_LOADER_PARAMS, trustPrebuiltAssets: "on", nodejsPackageHandler: _MakeHandler() }
        })

        assert.equal(buildCalls.count, 1, "sem artefato, cai para o build normal mesmo confiando")
    })

    it("perfil de watch nunca serve pré-construído, mesmo com artefato pronto", async () => {
        const { WebInterfaceBuilder, buildCalls } = _MakeFakeWebInterfaceBuilder({
            profile: { name: "debug-watch", watch: true },
            prebuilt: true,
            manifest: { builtAt: "2026-01-01T00:00:00.000Z" }
        })
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        await Start({ loaderParams: { ...BASE_LOADER_PARAMS, isWatch: true, nodejsPackageHandler: _MakeHandler() } })

        assert.equal(buildCalls.count, 1, "watch sempre observa a partir do zero")
    })

    it("sem BuildCache injetado (ecosystem-core anterior a este recurso), cai para o build normal", async () => {
        const { WebInterfaceBuilder, buildCalls } = _MakeFakeWebInterfaceBuilder({ withBuildCache: false })
        const Start = CreateStartWebGraphicUserInterfaceService({ WebInterfaceBuilder, paths: {} })

        const result = await Start({ loaderParams: { ...BASE_LOADER_PARAMS, nodejsPackageHandler: _MakeHandler() } })

        assert.equal(buildCalls.count, 1, "sem BuildCache não há como decidir — precisa compilar")
        assert.ok(result.output)
    })
})
