const { describe, it } = require('node:test') as typeof import('node:test')
const assert = (require('node:assert') as typeof import('node:assert')).strict

const OutputDirectory = require("../src/OutputDirectory")

describe("OutputDirectory — nome PORTÁVEL do diretório de saída", () => {

    const BASE = {
        serverAppName: "meu-painel",
        entrypoint:    "index.tsx",
        htmlTemplate:  "index.html",
        profileKey:    "release|dt:none|min:1|tso:0|sml:0",
        buildEngine:   "webpack"
    }

    it("a mesma entrada dá o mesmo nome", () => {
        assert.equal(OutputDirectory.ComputeOutputDirName(BASE), OutputDirectory.ComputeOutputDirName({ ...BASE }))
    })

    // A afirmação central desta lib: campos que amarram a MÁQUINA — caminhos
    // absolutos como `context`, `environmentPath`, `nodeModulesPath` — nem
    // fazem parte da assinatura, então passá-los (por engano, ou por reuso de
    // um `loaderParams` inteiro) não muda nada. É o que permite construir num
    // lugar (uma imagem, outro módulo) e servir noutro.
    it("ignora caminhos absolutos, mesmo que o chamador os passe junto", () => {
        const semExtras = OutputDirectory.ComputeOutputDirName(BASE)
        const comExtras = OutputDirectory.ComputeOutputDirName({
            ...BASE,
            context:         "/home/alice/checkout-1/pacote/.webgui",
            environmentPath: "/home/alice/ambiente-1",
            nodeModulesPath: "/home/alice/checkout-1/pacote/.webgui/node_modules"
        })
        assert.equal(semExtras, comExtras)

        const outraMaquina = OutputDirectory.ComputeOutputDirName({
            ...BASE,
            context:         "/var/containers/xyz/pacote/.webgui",
            environmentPath: "/mnt/ambientes/prod",
            nodeModulesPath: "/var/containers/xyz/pacote/.webgui/node_modules"
        })
        assert.equal(semExtras, outraMaquina, "duas máquinas, mesmo pacote — precisa dar o mesmo nome")
    })

    it("muda quando o app, a entrada, o template, o perfil ou o motor mudam", () => {
        const base = OutputDirectory.ComputeOutputDirName(BASE)

        assert.notEqual(OutputDirectory.ComputeOutputDirName({ ...BASE, serverAppName: "outro-painel" }), base)
        assert.notEqual(OutputDirectory.ComputeOutputDirName({ ...BASE, entrypoint: "outro.tsx" }), base)
        assert.notEqual(OutputDirectory.ComputeOutputDirName({ ...BASE, htmlTemplate: "outro.html" }), base)
        assert.notEqual(OutputDirectory.ComputeOutputDirName({ ...BASE, profileKey: "debug|..." }), base)
        assert.notEqual(OutputDirectory.ComputeOutputDirName({ ...BASE, buildEngine: "rspack" }), base)
    })
})

describe("OutputDirectory — onde o diretório é montado", () => {

    it("junta ambiente, diretório gerado e o sufixo de assets", () => {
        const outputDirName = OutputDirectory.ComputeOutputDirName({ serverAppName: "app" })
        const output = OutputDirectory.MountOutputDirPath({
            environmentPath: "/ambiente",
            outputDirName,
            generatedDirName: ".generated_data"
        })
        assert.equal(output, `/ambiente/.generated_data/${outputDirName}.${OutputDirectory.DIR_SUFFIX}`)
    })
})
