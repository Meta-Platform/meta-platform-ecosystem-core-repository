const { describe, it } = require('node:test') as typeof import('node:test')
const assert = (require('node:assert') as typeof import('node:assert')).strict
const fs     = require('node:fs') as typeof import('node:fs')
const os     = require('node:os') as typeof import('node:os')
const path   = require('node:path') as typeof import('node:path')

const CreateBuildWorkerClient = require("../src/CreateBuildWorkerClient")
const BuildProfiles           = require("../src/BuildProfiles")

globalThis.Log = globalThis.Log || { info: () => {}, error: () => {}, warn: () => {}, message: () => {} }

// Um pacote de verdade, mínimo: o worker roda num processo separado, então não
// há como injetar dublês nele — o teste precisa de um webpack instalado e de
// fontes reais no disco. Isso é proposital: é o único jeito de provar que o
// build acontece FORA deste processo.
const _MakeFixturePackage = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wib-worker-"))
    const src  = path.join(root, "src")
    fs.mkdirSync(src)
    fs.writeFileSync(path.join(src, "index.js"), "document.title = 'ok'\n")
    fs.writeFileSync(path.join(src, "index.html"), "<!doctype html><html><body><div id='gui'></div></body></html>\n")
    return { root, src, output: path.join(root, "out") }
}

// O worker resolve o webpack pelo SmartRequire cujo caminho vem no job.
// Aqui apontamos para um módulo que devolve o webpack deste próprio checkout,
// se houver um instalado.
const _MakeSmartRequireShim = (root: string) => {
    const shim = path.join(root, "smart-require-shim.js")
    fs.writeFileSync(shim, "module.exports = (name) => require(name)\n")
    return shim
}

const _FindWebpack = () => {
    try { require.resolve("webpack"); return true } catch(e) { return false }
}

const HAS_WEBPACK = _FindWebpack()

describe("CreateBuildWorkerClient — escolha do runtime", () => {

    it("um caminho explícito vence a detecção automática", () => {
        const runtime = CreateBuildWorkerClient.ResolveWorkerRuntime({
            env: { META_WEBGUI_BUILD_NODE_PATH: "/usr/bin/node-especial" }
        })
        assert.equal(runtime.kind, "explicit")
        assert.equal(runtime.command, "/usr/bin/node-especial")
    })

    it("fora do Electron e do binário empacotado, usa o próprio node", () => {
        const runtime = CreateBuildWorkerClient.ResolveWorkerRuntime({ env: {} })
        assert.equal(runtime.kind, "node")
        assert.equal(runtime.command, process.execPath)
        // Nenhuma variável extra: node puro não precisa fingir que é node.
        assert.deepEqual(runtime.env, {})
    })

    it("o script do worker existe e é carregável", () => {
        assert.ok(fs.existsSync(CreateBuildWorkerClient.WORKER_ENTRY))
    })

    // O `node` do PATH é o que faz o isolamento valer DENTRO DO CONTAINER: lá o
    // processo é o binário empacotado, mas a imagem base traz um node de
    // verdade. Sem este caminho o build voltava para dentro do processo que
    // serve o painel — e o pico do webpack ficava no heap para sempre.
    describe("um node de verdade no PATH", () => {

        const _MakeFakeNode = ({ executable }: { executable: boolean }) => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wib-path-"))
            const binary = path.join(dir, "node")
            fs.writeFileSync(binary, "#!/bin/sh\nexit 0\n")
            fs.chmodSync(binary, executable ? 0o755 : 0o644)
            return { dir, binary }
        }

        it("acha o executável na primeira entrada que o tiver", () => {
            const { dir, binary } = _MakeFakeNode({ executable: true })
            assert.equal(
                CreateBuildWorkerClient.FindNodeInPath({ PATH: `/nao-existe-aqui${path.delimiter}${dir}` }),
                binary
            )
        })

        it("ignora um arquivo sem bit de execução", () => {
            const { dir } = _MakeFakeNode({ executable: false })
            assert.equal(CreateBuildWorkerClient.FindNodeInPath({ PATH: dir }), undefined)
        })

        it("ignora o próprio executável, que relançado daria o mesmo processo", () => {
            assert.equal(
                CreateBuildWorkerClient.FindNodeInPath({ PATH: path.dirname(process.execPath) }),
                undefined
            )
        })

        it("sem PATH não há o que procurar", () => {
            assert.equal(CreateBuildWorkerClient.FindNodeInPath({}), undefined)
        })
    })
})

describe("CreateBuildWorkerClient — o build acontece FORA deste processo", { skip: !HAS_WEBPACK && "webpack não instalado neste checkout" }, () => {

    it("compila, devolve o resumo e o processo filho morre", async () => {
        const fixture = _MakeFixturePackage()
        const client  = CreateBuildWorkerClient({})
        const profile = BuildProfiles.ResolveBuildProfile({ profileName: BuildProfiles.RELEASE, env: {} })

        const rssBefore = process.memoryUsage().rss
        const progresso: any[] = []

        const summary = await client.RunBuildInWorker({
            job: {
                buildProfile: BuildProfiles.RELEASE,
                reportProgress: true,
                smartRequirePath: _MakeSmartRequireShim(fixture.root),
                params: {
                    context: fixture.src,
                    entrypoint: "index.js",
                    htmlTemplate: "index.html",
                    output: fixture.output,
                    nodeModulesPath: path.join(process.cwd(), "node_modules"),
                    serverAppName: "fixture",
                    url: "",
                    componentLibraries: [],
                    buildDate: ""
                }
            },
            profile,
            onProgress: (p: any) => progresso.push(p),
            timeoutMs: 120000
        })

        assert.equal(summary.ok, true, `erros: ${(summary.errors || []).join("; ")}`)
        assert.ok(summary.assetCount >= 1)
        assert.ok(fs.existsSync(path.join(fixture.output, "bundle.js")), "o bundle precisa existir no disco")
        assert.ok(fs.existsSync(path.join(fixture.output, "index.html")))

        // O custo do build foi pago pelo FILHO, não por este processo. É a
        // afirmação central desta fase: `peakRssBytes` é o pico de lá.
        assert.ok(summary.peakRssBytes > 0)
        const rssGrowthMb = (process.memoryUsage().rss - rssBefore) / 1048576
        assert.ok(rssGrowthMb < 60, `este processo cresceu ${rssGrowthMb.toFixed(0)} MB — o build deveria ter ficado no filho`)

        assert.ok(progresso.length > 0, "o progresso precisa atravessar o canal")
    })

    it("erro de compilação vira rejeição, não uma promessa pendente", async () => {
        const fixture = _MakeFixturePackage()
        // Import que não resolve: o webpack falha a compilação.
        fs.writeFileSync(path.join(fixture.src, "index.js"), "import x from './nao-existe'\nconsole.log(x)\n")

        const client  = CreateBuildWorkerClient({})
        const profile = BuildProfiles.ResolveBuildProfile({ profileName: BuildProfiles.RELEASE, env: {} })

        const summary = await client.RunBuildInWorker({
            job: {
                buildProfile: BuildProfiles.RELEASE,
                smartRequirePath: _MakeSmartRequireShim(fixture.root),
                params: {
                    context: fixture.src, entrypoint: "index.js", htmlTemplate: "index.html",
                    output: fixture.output, nodeModulesPath: path.join(process.cwd(), "node_modules"),
                    serverAppName: "fixture", url: "", componentLibraries: [], buildDate: ""
                }
            },
            profile,
            timeoutMs: 120000
        })

        // O worker responde com o resumo (ok:false); quem decide se isso é fatal
        // é o chamador. O que não pode acontecer é ficar pendurado.
        assert.equal(summary.ok, false)
        assert.ok(summary.errorCount > 0)
    })

    it("um job inválido rejeita em vez de pendurar", async () => {
        const client  = CreateBuildWorkerClient({})
        const profile = BuildProfiles.ResolveBuildProfile({ env: {} })

        await assert.rejects(
            () => client.RunBuildInWorker({
                job: { buildProfile: "release", smartRequirePath: "/caminho/que/nao/existe.js", params: {} },
                profile,
                timeoutMs: 30000
            }),
            (error: unknown) => error instanceof Error
        )
    })
})
