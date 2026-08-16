/** As formas do build de interface web: perfil, bibliotecas e cache. */

export type BuildProfileName = "release" | "debug" | "debug-watch"

/**
 * Um conjunto COERENTE de decisões de build. Escolher o perfil é uma decisão
 * só; ajustar devtool, minimize e transpileOnly separadamente são cinco que
 * quase sempre andam juntas.
 */
export type BuildProfile = {
    name: string
    mode: "production" | "development"
    devtool: string | false
    minimize: boolean
    minimizeParallel: boolean
    transpileOnly: boolean
    applySourceMapLoader: boolean
    cacheType: "filesystem" | false
    watch: boolean
    /** `false` ou o intervalo de polling em ms. */
    watchPoll: number | false
    statsPreset: string
    maxOldSpaceMb: number
    stableBuildDate: boolean
}

/** Uma biblioteca de componentes que entra no bundle do webgui. */
export type ComponentLibrary = {
    alias?: string
    sourcePath?: string
    nodeModulesPath?: string
}

/**
 * Um `.wasmlib` que entra no bundle. O `binaryPath` aponta para o `.wasm`
 * versionado; o `alias` é o nome pelo qual o código do webgui o pede.
 */
export type WasmModule = {
    alias?: string
    binaryPath?: string
    packageName?: string
    version?: string
}

export type BuildManifest = {
    cacheVersion: number
    fingerprint?: string
    serverAppName: string | null
    profileName: string | null
    builtAt: string
}
