const { describe, it, beforeEach } = require('node:test') as typeof import('node:test')
const assert = (require('node:assert') as typeof import('node:assert')).strict
const fs     = require('node:fs') as typeof import('node:fs')
const os     = require('node:os') as typeof import('node:os')
const path   = require('node:path') as typeof import('node:path')

const BuildCache = require("../src/BuildCache")

const _MakeTree = (files: Record<string, string>) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wib-cache-"))
    for(const [rel, content] of Object.entries(files)){
        const full = path.join(root, rel)
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.writeFileSync(full, content)
    }
    return root
}

const _MakeAssetsDir = (generatedDir: string, name: string, { builtAt, withArtifacts = true }: { builtAt?: string | null, withArtifacts?: boolean } = {}) => {
    const dir = path.join(generatedDir, name)
    fs.mkdirSync(dir, { recursive: true })
    if(withArtifacts){
        fs.writeFileSync(path.join(dir, "index.html"), "<html></html>")
        fs.writeFileSync(path.join(dir, "bundle.js"), "console.log(1)")
    }
    if(builtAt !== null)
        fs.writeFileSync(path.join(dir, ".meta-build-manifest.json"), JSON.stringify({
            cacheVersion: BuildCache.CACHE_VERSION,
            fingerprint: "abc",
            builtAt: builtAt || new Date().toISOString()
        }))
    return dir
}

const DAYS_AGO = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

describe("BuildCache — assinatura das entradas", () => {

    let context: string
    beforeEach(() => { context = _MakeTree({ "index.tsx": "export default 1", "app/App.tsx": "// app" }) })

    it("a mesma entrada dá a mesma assinatura", () => {
        const a = BuildCache.ComputeWebInterfaceFingerprint({ context, buildProfile: "release" })
        const b = BuildCache.ComputeWebInterfaceFingerprint({ context, buildProfile: "release" })
        assert.equal(a, b)
    })

    it("mudar a fonte muda a assinatura", () => {
        const before = BuildCache.ComputeWebInterfaceFingerprint({ context, buildProfile: "release" })
        fs.writeFileSync(path.join(context, "app/App.tsx"), "// alterado")
        assert.notEqual(BuildCache.ComputeWebInterfaceFingerprint({ context, buildProfile: "release" }), before)
    })

    it("o perfil entra na assinatura", () => {
        // Sem isto, um build release reaproveitaria o bundle de depuração que
        // estivesse no mesmo diretório.
        const release = BuildCache.ComputeWebInterfaceFingerprint({ context, buildProfile: "release" })
        const debug   = BuildCache.ComputeWebInterfaceFingerprint({ context, buildProfile: "debug" })
        assert.notEqual(release, debug)
    })

    it("entrypoint e template entram na assinatura", () => {
        // Mudam o resultado do build sem mudar byte nenhum da árvore.
        const a = BuildCache.ComputeWebInterfaceFingerprint({ context, entrypoint: "index.tsx", htmlTemplate: "index.html" })
        const b = BuildCache.ComputeWebInterfaceFingerprint({ context, entrypoint: "outro.tsx", htmlTemplate: "index.html" })
        assert.notEqual(a, b)
    })

    it("node_modules entra por tamanho, não por conteúdo nem por data", () => {
        const nodeModules = _MakeTree({ "pacote/index.js": "module.exports = 1" })
        const before = BuildCache.ComputeWebInterfaceFingerprint({ context, nodeModules })

        // Reescrever com o MESMO tamanho é indistinguível pelo modo "stat". É a
        // troca consciente que evita ler centenas de MB a cada abertura.
        const alvo = path.join(nodeModules, "pacote/index.js")
        fs.writeFileSync(alvo, "module.exports = 2")
        assert.equal(BuildCache.ComputeWebInterfaceFingerprint({ context, nodeModules }), before)

        // Mudar a DATA também não pode mudar a assinatura: o ambiente de
        // execução refaz o .dependencies a cada subida, copiando os mesmos
        // arquivos com mtime novo. Com a data na conta, o cache nunca acertava.
        fs.utimesSync(alvo, new Date(), new Date(Date.now() + 60000))
        assert.equal(BuildCache.ComputeWebInterfaceFingerprint({ context, nodeModules }), before)

        // Mas mudança real de dependência aparece: tamanho diferente...
        fs.writeFileSync(alvo, "module.exports = 'versao nova e maior'")
        assert.notEqual(BuildCache.ComputeWebInterfaceFingerprint({ context, nodeModules }), before)

        // ...e arquivo novo também.
        fs.writeFileSync(alvo, "module.exports = 1")
        fs.writeFileSync(path.join(nodeModules, "pacote/novo.js"), "x")
        assert.notEqual(BuildCache.ComputeWebInterfaceFingerprint({ context, nodeModules }), before)
    })

    it("a fonte das bibliotecas de componentes entra por conteúdo", () => {
        const lib = _MakeTree({ "index.ts": "export const A = 1" })
        const componentLibraries = [{ alias: "@i-components", sourcePath: lib }]

        const before = BuildCache.ComputeWebInterfaceFingerprint({ context, componentLibraries })
        // Mesmo tamanho e mtime restaurado: por conteúdo, ainda assim muda.
        const alvo = path.join(lib, "index.ts")
        const { atime, mtime } = fs.statSync(alvo)
        fs.writeFileSync(alvo, "export const A = 2")
        fs.utimesSync(alvo, atime, mtime)

        assert.notEqual(BuildCache.ComputeWebInterfaceFingerprint({ context, componentLibraries }), before)
    })

    it("o binário do .wasmlib entra por conteúdo, e não por tamanho", () => {
        const dir = _MakeTree({ "modulo.wasm": "AAAA" })
        const wasmModules = [{ alias: "@geometry", binaryPath: path.join(dir, "modulo.wasm") }]

        const before = BuildCache.ComputeWebInterfaceFingerprint({ context, wasmModules })

        // Recompilar o módulo troca os bytes mantendo o tamanho; assinar por
        // stat serviria o bundle com o .wasm anterior dentro.
        const alvo = path.join(dir, "modulo.wasm")
        const { atime, mtime } = fs.statSync(alvo)
        fs.writeFileSync(alvo, "BBBB")
        fs.utimesSync(alvo, atime, mtime)

        assert.notEqual(BuildCache.ComputeWebInterfaceFingerprint({ context, wasmModules }), before)
    })

    it("sem .wasmlib, a assinatura é a mesma de antes do recurso", () => {
        assert.equal(
            BuildCache.ComputeWebInterfaceFingerprint({ context, wasmModules: [] }),
            BuildCache.ComputeWebInterfaceFingerprint({ context })
        )
    })
})

describe("BuildCache — quando o bundle serve", () => {

    it("serve só com manifesto, assinatura igual e artefatos no disco", () => {
        const generated = fs.mkdtempSync(path.join(os.tmpdir(), "wib-gen-"))
        const output = path.join(generated, "app.webInterfaceAssets")
        fs.mkdirSync(output)
        fs.writeFileSync(path.join(output, "index.html"), "<html></html>")
        fs.writeFileSync(path.join(output, "bundle.js"), "1")

        assert.equal(BuildCache.IsWebInterfaceFresh({ output, fingerprint: "abc" }), false, "sem manifesto não serve")

        BuildCache.WriteBuildManifest(output, { fingerprint: "abc", serverAppName: "app", profileName: "release" })
        assert.equal(BuildCache.IsWebInterfaceFresh({ output, fingerprint: "abc" }), true)

        assert.equal(BuildCache.IsWebInterfaceFresh({ output, fingerprint: "outra" }), false)
        assert.equal(BuildCache.IsWebInterfaceFresh({ output, fingerprint: null }), false)

        // Artefato sumiu: qualquer dúvida ⇒ recompila. Errar para o lado de
        // recompilar custa tempo; errar para o outro serve interface velha.
        fs.rmSync(path.join(output, "bundle.js"))
        assert.equal(BuildCache.IsWebInterfaceFresh({ output, fingerprint: "abc" }), false)
    })

    it("manifesto de versão antiga não serve", () => {
        const output = fs.mkdtempSync(path.join(os.tmpdir(), "wib-old-"))
        fs.writeFileSync(path.join(output, "index.html"), "<html></html>")
        fs.writeFileSync(path.join(output, "bundle.js"), "1")
        fs.writeFileSync(path.join(output, ".meta-build-manifest.json"),
            JSON.stringify({ cacheVersion: 1, fingerprint: "abc" }))

        assert.equal(BuildCache.IsWebInterfaceFresh({ output, fingerprint: "abc" }), false)
    })
})

describe("BuildCache — presença de artefato pré-construído, sem fingerprint", () => {

    // `HasPrebuiltWebInterfaceArtifacts` existe para o modo `trustPrebuiltAssets`:
    // ele NUNCA recebe um fingerprint (a assinatura nem é calculada — é
    // justamente a varredura de node_modules que esse modo evita), só confere
    // manifesto e arquivos no disco.

    it("serve com manifesto da versão certa e os dois artefatos no disco", () => {
        const generated = fs.mkdtempSync(path.join(os.tmpdir(), "wib-trust-"))
        const output = path.join(generated, "app.webInterfaceAssets")
        fs.mkdirSync(output)
        fs.writeFileSync(path.join(output, "index.html"), "<html></html>")
        fs.writeFileSync(path.join(output, "bundle.js"), "1")

        assert.equal(BuildCache.HasPrebuiltWebInterfaceArtifacts({ output }), false, "sem manifesto não serve")

        BuildCache.WriteBuildManifest(output, { fingerprint: "não importa aqui", serverAppName: "app", profileName: "release" })
        assert.equal(BuildCache.HasPrebuiltWebInterfaceArtifacts({ output }), true)
    })

    it("manifesto de versão antiga não serve", () => {
        const output = fs.mkdtempSync(path.join(os.tmpdir(), "wib-trust-old-"))
        fs.writeFileSync(path.join(output, "index.html"), "<html></html>")
        fs.writeFileSync(path.join(output, "bundle.js"), "1")
        fs.writeFileSync(path.join(output, ".meta-build-manifest.json"), JSON.stringify({ cacheVersion: 1 }))

        assert.equal(BuildCache.HasPrebuiltWebInterfaceArtifacts({ output }), false)
    })

    it("artefato ausente não serve, mesmo com manifesto presente", () => {
        const output = fs.mkdtempSync(path.join(os.tmpdir(), "wib-trust-missing-"))
        BuildCache.WriteBuildManifest(output, { fingerprint: "x" })
        fs.writeFileSync(path.join(output, "index.html"), "<html></html>")
        // sem bundle.js

        assert.equal(BuildCache.HasPrebuiltWebInterfaceArtifacts({ output }), false)
    })

    it("diretório inexistente não é erro", () => {
        assert.equal(
            BuildCache.HasPrebuiltWebInterfaceArtifacts({ output: path.join(os.tmpdir(), "wib-trust-nao-existe") }),
            false
        )
    })
})

describe("BuildCache — faxina de assets órfãos", () => {

    let generated: string
    beforeEach(() => { generated = fs.mkdtempSync(path.join(os.tmpdir(), "wib-purge-")) })

    it("remove o que é antigo e não está em uso", () => {
        const antigo = _MakeAssetsDir(generated, "velho.webInterfaceAssets", { builtAt: DAYS_AGO(30) })
        const removed = BuildCache.PurgeStaleWebInterfaceAssets({ generatedDirPath: generated, maxAgeDays: 7 })

        assert.deepEqual(removed, ["velho.webInterfaceAssets"])
        assert.equal(fs.existsSync(antigo), false)
    })

    it("preserva o diretório em uso, por mais antigo que seja", () => {
        const emUso = _MakeAssetsDir(generated, "atual.webInterfaceAssets", { builtAt: DAYS_AGO(90) })
        const removed = BuildCache.PurgeStaleWebInterfaceAssets({
            generatedDirPath: generated,
            keepDirNames: [emUso],
            maxAgeDays: 7
        })

        assert.deepEqual(removed, [])
        assert.equal(fs.existsSync(emUso), true)
    })

    it("preserva o recente — outra instância pode estar servindo aquilo agora", () => {
        const recente = _MakeAssetsDir(generated, "recente.webInterfaceAssets", { builtAt: DAYS_AGO(1) })
        BuildCache.PurgeStaleWebInterfaceAssets({ generatedDirPath: generated, maxAgeDays: 7 })
        assert.equal(fs.existsSync(recente), true)
    })

    it("não toca em nada que não tenha cara de assets nossos", () => {
        // Sem manifesto não dá para afirmar que o diretório é nosso.
        const semManifesto = _MakeAssetsDir(generated, "estranho.webInterfaceAssets", { builtAt: null })
        // E o que nem tem o sufixo está fora de questão.
        const outraCoisa = path.join(generated, "banco-de-dados")
        fs.mkdirSync(outraCoisa)
        fs.writeFileSync(path.join(outraCoisa, "dados.sqlite"), "importante")

        BuildCache.PurgeStaleWebInterfaceAssets({ generatedDirPath: generated, maxAgeDays: 0 })

        assert.equal(fs.existsSync(semManifesto), true)
        assert.equal(fs.existsSync(path.join(outraCoisa, "dados.sqlite")), true)
    })

    it("diretório inexistente não é erro", () => {
        assert.deepEqual(
            BuildCache.PurgeStaleWebInterfaceAssets({ generatedDirPath: path.join(generated, "nao-existe") }),
            []
        )
        assert.deepEqual(BuildCache.PurgeStaleWebInterfaceAssets({}), [])
    })
})
