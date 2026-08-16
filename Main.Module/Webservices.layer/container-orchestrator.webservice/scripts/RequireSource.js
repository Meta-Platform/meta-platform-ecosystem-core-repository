const fs   = require("fs")
const path = require("path")

/*
    Carrega um módulo de `src/` a partir de um script de manutenção.

    Estes scripts rodam por `node scripts/<nome>.js`, fora do Package Executor —
    e portanto sem a resolução de TypeScript, que é quem completa a extensão de
    um `require` sem ela. Não basta achar o primeiro arquivo: o módulo carregado
    pede os SEUS vizinhos do mesmo jeito, e a cadeia inteira precisa da
    resolução instalada. Por isso o helper instala a resolução, e só usa a
    procura por extensão como último recurso.

    O EssentialRepo, que é quem tem a resolução, aparece ao lado deste
    repositório com dois nomes diferentes: `essential-repository` no workspace
    de desenvolvimento e `EssentialRepo` no EcosystemData provisionado.

    Deliberadamente JavaScript: é ferramenta de manutenção, e precisa subir sem
    depender de nada.
*/

const REPOSITORIES_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..")
const ESSENTIAL_DIR_NAMES = ["essential-repository", "EssentialRepo"]
const REGISTER_RELATIVE = path.join(
    "Commons.Module", "Libraries.layer", "module-resolution.lib", "src", "register.js")

const _InstallTypeScriptResolution = () => {
    const register = ESSENTIAL_DIR_NAMES
        .map((name) => path.join(REPOSITORIES_DIR, name, REGISTER_RELATIVE))
        .find((candidate) => fs.existsSync(candidate))

    if(register) require(register)
}

_InstallTypeScriptResolution()

const RequireSource = (relativePath) => {
    const base = path.join(__dirname, "..", "src", relativePath)
    const found = [`${base}.js`, `${base}.ts`].find((candidate) => fs.existsSync(candidate))
    return require(found || base)
}

module.exports = RequireSource
