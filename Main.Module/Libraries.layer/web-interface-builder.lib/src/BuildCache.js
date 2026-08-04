const fs = require("fs")
const crypto = require("crypto")
const { join, basename } = require("path")

// Cache de build de interface web.
//
// A ideia: compilar de novo só quando a ENTRADA mudou. A assinatura cobre a
// fonte do webgui, as bibliotecas de componentes, o node_modules e o perfil de
// build; o diretório de saída fica de fora, então a assinatura calculada ANTES
// do build continua válida para gravar depois dele.
//
// Esta lib vive no ecosystem-core para que os dois caminhos usem o mesmo código:
// a janela desktop (que já tinha um cache próprio) e o endpoint HTTP (que
// recompilava do zero a cada subida da instância).

// v2: a configuração do webpack passou a depender do perfil de build (release
// não emite mapa de código e minifica; debug faz o contrário). Bundles gerados
// pela configuração anterior não correspondem mais a nenhum perfil.
const CACHE_VERSION = 2
const MANIFEST_FILE = ".meta-build-manifest.json"
const ASSETS_SUFFIX = ".webInterfaceAssets"

// Como uma árvore entra na assinatura.
//
//   "content" — lê os bytes de cada arquivo. Preciso, e caro na proporção do
//               tamanho da árvore. Usado na FONTE do webgui e nas bibliotecas
//               de componentes: são pequenas e são o que muda de verdade.
//
//   "stat"    — usa caminho e TAMANHO, sem data. Usado no node_modules, que tem
//               centenas de MB: ler tudo por conteúdo a cada abertura trocaria
//               um problema de memória por um de I/O.
//
//               A data ficou de fora depois de o cache nunca acertar em
//               instância servida por HTTP: o ambiente de execução refaz o
//               `.dependencies` a cada subida, copiando os MESMOS arquivos com
//               mtime novo. Com a data na conta, a assinatura mudava sempre e o
//               cache recompilava sempre — indistinguível de não ter cache.
//               O tamanho sobrevive à recriação e continua mudando quando a
//               dependência muda de versão de verdade.
const HASH_MODE = { CONTENT: "content", STAT: "stat" }

// Acrescenta ao hash a árvore inteira, em ordem determinística (entradas
// ordenadas por nome). Para cada entrada:
//   - arquivo: caminho relativo + conteúdo (ou tamanho/mtime, conforme o modo);
//   - symlink: caminho relativo + alvo do link (NÃO segue — evita ciclos e
//     varredura fora da árvore, ex.: os links em node_modules/.bin);
//   - diretório: marca o caminho e recorre.
// Falhas de leitura são absorvidas (a entrada entra como "ilegível") para nunca
// derrubar o cálculo.
const _HashTree = (hash, rootDir, currentDir, mode = HASH_MODE.CONTENT) => {
    let entries
    try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch(e) {
        return
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for(const entry of entries){
        const full = join(currentDir, entry.name)
        const rel  = full.slice(rootDir.length)
        if(entry.isSymbolicLink()){
            let target = ""
            try { target = fs.readlinkSync(full) } catch(e) {}
            hash.update("L:" + rel + " -> " + target + "\n")
        } else if(entry.isDirectory()){
            hash.update("D:" + rel + "\n")
            _HashTree(hash, rootDir, full, mode)
        } else if(entry.isFile()){
            hash.update("F:" + rel + "\n")
            try {
                if(mode === HASH_MODE.STAT){
                    hash.update(String(fs.statSync(full).size))
                } else {
                    hash.update(fs.readFileSync(full))
                }
            } catch(e) {
                hash.update("<unreadable>")
            }
        }
    }
}

// Assinatura (sha256 hex) das entradas do build.
const ComputeWebInterfaceFingerprint = ({
    context,
    nodeModules,
    componentLibraries = [],
    buildProfile,
    entrypoint,
    htmlTemplate
}) => {
    const hash = crypto.createHash("sha256")
    hash.update("v" + CACHE_VERSION + "\n")
    // A mesma fonte compilada com perfis diferentes produz artefatos
    // diferentes. Sem o perfil aqui, trocar de perfil serviria o bundle do
    // perfil anterior como se estivesse atualizado.
    hash.update("[profile]" + (buildProfile || "default") + "\n")
    // Entrada e template mudam o resultado sem mudar byte nenhum da árvore.
    hash.update("[entry]" + (entrypoint || "") + "|" + (htmlTemplate || "") + "\n")
    hash.update("[context]\n")
    if(context) _HashTree(hash, context, context, HASH_MODE.CONTENT)
    hash.update("[node_modules]\n")
    if(nodeModules) _HashTree(hash, nodeModules, nodeModules, HASH_MODE.STAT)
    for(const library of componentLibraries){
        hash.update(`[icomponents:${library.alias || ""}]\n`)
        if(library.sourcePath) _HashTree(hash, library.sourcePath, library.sourcePath, HASH_MODE.CONTENT)
        // O node_modules de uma biblioteca também influencia o bundle dela.
        if(library.nodeModulesPath) _HashTree(hash, library.nodeModulesPath, library.nodeModulesPath, HASH_MODE.STAT)
    }
    return hash.digest("hex")
}

const _ManifestPath = (output) => join(output, MANIFEST_FILE)

const ReadBuildManifest = (output) => {
    try {
        return JSON.parse(fs.readFileSync(_ManifestPath(output), "utf8"))
    } catch(e) {
        return null
    }
}

const WriteBuildManifest = (output, { fingerprint, serverAppName, profileName, builtAt } = {}) => {
    const manifest = {
        cacheVersion:  CACHE_VERSION,
        fingerprint:   fingerprint,
        serverAppName: serverAppName || null,
        profileName:   profileName || null,
        builtAt:       builtAt || new Date().toISOString()
    }
    try {
        fs.mkdirSync(output, { recursive: true })
        fs.writeFileSync(_ManifestPath(output), JSON.stringify(manifest, null, 2), "utf8")
    } catch(e) {}
    return manifest
}

// O bundle já montado serve (pula o webpack) somente se: existe manifesto da
// mesma CACHE_VERSION, a assinatura bate E os artefatos essenciais estão no
// disco. Qualquer dúvida ⇒ false ⇒ rebuild. Errar para o lado de recompilar
// custa tempo; errar para o outro serve uma interface desatualizada.
const IsWebInterfaceFresh = ({ output, fingerprint }) => {
    if(!fingerprint) return false
    const manifest = ReadBuildManifest(output)
    if(!manifest) return false
    if(manifest.cacheVersion !== CACHE_VERSION) return false
    if(manifest.fingerprint !== fingerprint) return false
    if(!fs.existsSync(join(output, "index.html"))) return false
    if(!fs.existsSync(join(output, "bundle.js"))) return false
    return true
}

// Remove diretórios de assets órfãos.
//
// O nome do diretório do caminho HTTP deriva de um hash da configuração (porta,
// URL, perfil, caminhos). Qualquer mudança nesses valores gera um diretório
// NOVO e abandona o anterior — e não havia nada que limpasse os antigos. Num
// ambiente que muda de porta algumas vezes, `.generated_data` só cresce.
//
// Conservador de propósito: só apaga o que tem cara de assets de interface,
// nunca o que está em uso nesta execução, e nunca o que foi tocado
// recentemente (outra instância pode estar servindo aquilo agora).
const PurgeStaleWebInterfaceAssets = ({
    generatedDirPath,
    keepDirNames = [],
    maxAgeDays = 7
} = {}) => {
    const removed = []
    if(!generatedDirPath) return removed

    const keep = new Set(keepDirNames.map((name) => basename(name)))
    const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

    let entries
    try { entries = fs.readdirSync(generatedDirPath, { withFileTypes: true }) }
    catch(e) { return removed }

    for(const entry of entries){
        if(!entry.isDirectory()) continue
        if(!entry.name.endsWith(ASSETS_SUFFIX)) continue
        if(keep.has(entry.name)) continue

        const full = join(generatedDirPath, entry.name)
        try {
            const manifest = ReadBuildManifest(full)
            // Sem manifesto não dá para afirmar que o diretório é nosso.
            if(!manifest) continue

            const referenceMs = Date.parse(manifest.builtAt) || fs.statSync(full).mtimeMs
            if(referenceMs > cutoffMs) continue

            fs.rmSync(full, { recursive: true, force: true })
            removed.push(entry.name)
        } catch(e) { /* um diretório que resiste fica onde está */ }
    }

    return removed
}

module.exports = {
    CACHE_VERSION,
    ASSETS_SUFFIX,
    HASH_MODE,
    ComputeWebInterfaceFingerprint,
    ReadBuildManifest,
    WriteBuildManifest,
    IsWebInterfaceFresh,
    PurgeStaleWebInterfaceAssets
}
