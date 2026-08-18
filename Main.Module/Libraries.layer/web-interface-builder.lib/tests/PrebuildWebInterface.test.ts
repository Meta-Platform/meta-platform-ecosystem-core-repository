const { describe, it } = require('node:test') as typeof import('node:test')
const assert = (require('node:assert') as typeof import('node:assert')).strict
const fs     = require('node:fs') as typeof import('node:fs')
const os     = require('node:os') as typeof import('node:os')
const path   = require('node:path') as typeof import('node:path')

const PrebuildWebInterface = require("../src/PrebuildWebInterface")
const OutputDirectory      = require("../src/OutputDirectory")
const BuildProfiles        = require("../src/BuildProfiles")

globalThis.Log = globalThis.Log || { info: () => {}, error: () => {}, warn: () => {}, message: () => {} }

// Um pacote de verdade, mínimo — mesma ideia de BuildWorker.test.ts: o
// pré-build também não tem dublê de webpack (compila para valer), então só
// roda se houver um webpack instalado neste checkout.
const _MakeFixturePackage = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wib-prebuild-"))
    const src  = path.join(root, "src")
    fs.mkdirSync(src)
    fs.writeFileSync(path.join(src, "index.js"), "document.title = 'ok'\n")
    fs.writeFileSync(path.join(src, "index.html"), "<!doctype html><html><body><div id='gui'></div></body></html>\n")
    return { root, src, output: path.join(root, "out") }
}

const _MakeSmartRequireShim = (root: string) => {
    const shim = path.join(root, "smart-require-shim.js")
    fs.writeFileSync(shim, "module.exports = (name) => require(name)\n")
    return shim
}

const _FindWebpack = () => {
    try { require.resolve("webpack"); return true } catch(e) { return false }
}

const HAS_WEBPACK = _FindWebpack()

describe("PrebuildWebInterface — entradas obrigatórias", () => {

    it("recusa config sem os campos obrigatórios, e nomeia os que faltam", async () => {
        await assert.rejects(
            () => PrebuildWebInterface({}),
            (error: any) => {
                assert.match(error.message, /context/)
                assert.match(error.message, /smartRequirePath/)
                return true
            }
        )
    })

    it("aceita quando só falta um campo — e nomeia só esse", async () => {
        const fixture = _MakeFixturePackage()
        await assert.rejects(
            () => PrebuildWebInterface({
                context: fixture.src,
                entrypoint: "index.js",
                htmlTemplate: "index.html",
                nodeModulesPath: path.join(process.cwd(), "node_modules"),
                serverName: "fixture",
                environmentPath: fixture.root,
                generatedDirName: ".generated_data"
                // smartRequirePath ausente de propósito
            } as any),
            (error: any) => {
                assert.match(error.message, /smartRequirePath/)
                assert.doesNotMatch(error.message, /context/)
                return true
            }
        )
    })
})

describe("PrebuildWebInterface — não aceita perfil de watch", () => {

    it("rejeita antes de compilar: pré-build produz UM artefato e para", async () => {
        const fixture = _MakeFixturePackage()
        await assert.rejects(
            () => PrebuildWebInterface({
                context: fixture.src,
                entrypoint: "index.js",
                htmlTemplate: "index.html",
                nodeModulesPath: path.join(process.cwd(), "node_modules"),
                serverName: "fixture",
                environmentPath: fixture.root,
                generatedDirName: ".generated_data",
                smartRequirePath: _MakeSmartRequireShim(fixture.root),
                buildProfile: BuildProfiles.DEBUG_WATCH
            }),
            /não aceita o perfil/
        )
    })
})

describe(
    "PrebuildWebInterface — o build acontece de verdade, fora do ciclo de vida do serviço",
    { skip: !HAS_WEBPACK && "webpack não instalado neste checkout" },
    () => {

        it("produz o artefato no MESMO diretório que StartWebGraphicUserInterfaceService calcularia", async () => {
            const fixture = _MakeFixturePackage()

            const config = {
                context: fixture.src,
                entrypoint: "index.js",
                htmlTemplate: "index.html",
                nodeModulesPath: path.join(process.cwd(), "node_modules"),
                serverName: "fixture",
                environmentPath: fixture.root,
                generatedDirName: ".generated_data",
                smartRequirePath: _MakeSmartRequireShim(fixture.root),
                buildProfile: BuildProfiles.RELEASE
            }

            const { output, summary } = await PrebuildWebInterface(config)

            assert.equal(summary.ok, true, `erros: ${(summary.errors || []).join("; ")}`)
            assert.ok(fs.existsSync(path.join(output, "bundle.js")))
            assert.ok(fs.existsSync(path.join(output, "index.html")))

            // A MESMA conta que o taskLoader faz em runtime — é o que garante
            // que um artefato pré-construído seja achado por quem sobe o
            // endpoint depois.
            const profile = BuildProfiles.ResolveBuildProfile({ profileName: config.buildProfile })
            const profileKey = BuildProfiles.GetProfileFingerprintKey(profile)
            const outputDirNameEsperado = OutputDirectory.ComputeOutputDirName({
                serverAppName: config.serverName,
                entrypoint: config.entrypoint,
                htmlTemplate: config.htmlTemplate,
                profileKey,
                buildEngine: config.buildEngine
            })
            const outputEsperado = OutputDirectory.MountOutputDirPath({
                environmentPath: config.environmentPath,
                outputDirName: outputDirNameEsperado,
                generatedDirName: config.generatedDirName
            })

            assert.equal(output, outputEsperado)
        })

        it("um segundo pré-build acerta o cache — não recompila", async () => {
            const fixture = _MakeFixturePackage()
            const config = {
                context: fixture.src,
                entrypoint: "index.js",
                htmlTemplate: "index.html",
                nodeModulesPath: path.join(process.cwd(), "node_modules"),
                serverName: "fixture-cache",
                environmentPath: fixture.root,
                generatedDirName: ".generated_data",
                smartRequirePath: _MakeSmartRequireShim(fixture.root),
                buildProfile: BuildProfiles.RELEASE
            }

            const first  = await PrebuildWebInterface(config)
            assert.equal(first.fromCache, false)

            const second = await PrebuildWebInterface(config)
            assert.equal(second.fromCache, true)
            assert.equal(second.output, first.output)
        })
    }
)
