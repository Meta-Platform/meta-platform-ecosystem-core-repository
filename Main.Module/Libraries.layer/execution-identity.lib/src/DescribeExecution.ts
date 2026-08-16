const fs = require("fs") as typeof import("fs")
const { join, resolve } = require("path") as typeof import("path")
const { execFileSync } = require("child_process") as typeof import("child_process")

// "O QUE exatamente está rodando aqui?"
//
// Um processo do ecossistema pode ter sido lançado de três lugares diferentes —
// a fonte provisionada em EcosystemData, um binário empacotado com pkg, ou um
// release baixado — e olhar para o processo não diz qual. Sem essa resposta, o
// monitor mostra "meta-project-manager-mcp está no ar" e ninguém sabe se é a
// versão nova ou a de três dias atrás (IEXP-26).
//
// Tudo aqui é best-effort: nenhuma coleta pode derrubar quem está subindo.

/** De onde o processo saiu. Ver `_describeOrigin`. */
type ExecutionOrigin = "pkg-binary" | "source" | "release"

type PackageInfo = {
    name?: string
    version?: string
    namespace?: string
}

export type ExecutionIdentity = {
    packagePath?: string
    name?: string
    namespace?: string
    version: string | null
    origin?: ExecutionOrigin
    executablePath?: string
    branch?: string
    commit?: string
    pid: number
    node: string
    startedAt: string
    [field: string]: unknown
}

// Versão declarada do pacote. `metadata/package.json` é o metadado da plataforma
// e costuma trazer só o namespace; a versão de fato vive no package.json npm ao
// lado — lemos os dois, nessa ordem de preferência.
const _readPackageInfo = (packagePath: string): PackageInfo => {
    const out: PackageInfo = { name: undefined, version: undefined, namespace: undefined }
    const read = (file: string): any => {
        try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch(e){ return undefined }
    }
    const meta = read(join(packagePath, "metadata", "package.json"))
    const npm = read(join(packagePath, "package.json"))
    if(meta){
        out.namespace = meta.namespace
        if(meta.version) out.version = meta.version
        if(meta.name) out.name = meta.name
    }
    if(npm){
        if(!out.version && npm.version) out.version = npm.version
        if(!out.name && npm.name) out.name = npm.name
    }
    return out
}

// De ONDE este processo está rodando.
//  - pkg-binary: empacotado (process.pkg / PKG_EXECPATH), o caso do pkg-exec;
//  - source: fonte provisionada em EcosystemData/repos (o normal em dev);
//  - release: fonte fora do EcosystemData (baixada, clonada à mão…).
const _describeOrigin = (packagePath?: string): { origin: ExecutionOrigin, executablePath: string } => {
    const execPath = process.env.PKG_EXECPATH && process.env.PKG_EXECPATH !== "PKG_INVOKE_NODEJS"
        ? process.env.PKG_EXECPATH
        : undefined
    // `process.pkg` só existe dentro de um binário empacotado — o @types/node
    // não o conhece, e não teria como: quem o cria é o empacotador.
    if(execPath || (process as any).pkg)
        return { origin: "pkg-binary", executablePath: execPath || process.execPath }
    const inEcosystem = /[/\\]EcosystemData[/\\]repos[/\\]/.test(packagePath || "")
    return {
        origin: inEcosystem ? "source" : "release",
        executablePath: process.execPath
    }
}

// Branch e commit de onde o pacote foi provisionado. Release baixado não tem
// git — e isso não é erro, é informação (o campo simplesmente não vem).
const _gitSnapshot = (cwd?: string): { branch?: string, commit?: string } => {
    const run = (args: string[]): string | undefined => {
        try {
            return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || undefined
        } catch(e){ return undefined }
    }
    if(!cwd) return {}
    return { branch: run(["rev-parse", "--abbrev-ref", "HEAD"]), commit: run(["rev-parse", "--short", "HEAD"]) }
}

/**
 * Identidade da execução corrente.
 *
 * `packagePath` é o caminho do pacote que está sendo executado; o resto do
 * objeto (`extra`) é fundido no resultado — é por onde entra, por exemplo, o
 * `launchedBy`.
 */
const DescribeExecution = ({ packagePath, ...extra }: { packagePath?: string, [field: string]: unknown } = {}): ExecutionIdentity => {
    const absolute = packagePath ? resolve(packagePath) : undefined
    const info: PackageInfo = absolute ? _readPackageInfo(absolute) : {}
    const origin = _describeOrigin(absolute)
    const git = absolute && fs.existsSync(absolute) ? _gitSnapshot(absolute) : {}
    return {
        packagePath: absolute,
        name: info.name,
        namespace: info.namespace,
        version: info.version || null,
        ...origin,
        ...git,
        pid: process.pid,
        node: process.version,
        startedAt: new Date().toISOString(),
        ...extra
    }
}

/**
 * A versão que está rodando é a que está instalada AGORA no disco?
 *
 * É a pergunta que motivou tudo isto: o painel precisa dizer "desatualizada"
 * sem obrigar ninguém a comparar número à mão. Compara a versão registrada na
 * identidade com a lida do pacote neste instante.
 *
 * Devolve `null` quando não dá para saber (sem versão declarada) — melhor um
 * "não sei" explícito do que um falso "está atualizada".
 */
const IsOutdated = ({ identity }: { identity?: ExecutionIdentity } = {}) => {
    if(!identity || !identity.packagePath || !identity.version) return null
    const current = _readPackageInfo(identity.packagePath).version
    if(!current) return null
    return current !== identity.version ? { outdated: true, running: identity.version, installed: current } : { outdated: false, running: identity.version, installed: current }
}

module.exports = { DescribeExecution, IsOutdated }
