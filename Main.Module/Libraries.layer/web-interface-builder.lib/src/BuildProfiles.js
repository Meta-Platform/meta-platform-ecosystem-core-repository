// Perfis de build de interface web.
//
// Até aqui a configuração do webpack era única e embutida, e no pior par
// possível: sem `mode` (o webpack 5 assume `production`, com Terser) MAIS
// `devtool: "source-map"` — o source map completo, o modo mais caro em memória
// e em CPU. Não havia como pedir um build de desenvolvimento nem um build
// enxuto: todo mundo pagava os dois custos ao mesmo tempo.
//
// Um perfil é um conjunto coerente de decisões. Escolher "debug" ou "release"
// é uma decisão só; ajustar devtool, minimize, transpileOnly e cache
// separadamente são cinco decisões que quase sempre andam juntas.
//
// ATENÇÃO AO TIPO DOS VALORES — os perfis chegam por parâmetro de pacote, e o
// pipeline de parâmetros (GetPopulatedParameters, no execution-params-generator)
// resolve assim:
//
//     TryGetValue(value, params) || (IsHandlebar(value) && ...) || value
//
// Com `false`, `0` ou `""` a expressão cai no `|| value` e devolve a STRING do
// nome do parâmetro, que é truthy. Ou seja: um parâmetro booleano só consegue
// ser ligado, nunca desligado. Por isso todo parâmetro daqui é string
// ("release", "on", "off") — ver ResolveIsolationFlag.

const RELEASE     = "release"
const DEBUG       = "debug"
const DEBUG_WATCH = "debug-watch"

const DEFAULT_PROFILE_NAME = RELEASE

const PROFILE_NAMES = [RELEASE, DEBUG, DEBUG_WATCH]

const PROFILES = {

    // O build que vai ao usuário: nada de mapa de código, tudo minificado, e o
    // typecheck ligado — é a última chance de pegar um erro de tipo antes de o
    // bundle virar produto.
    [RELEASE]: {
        name:                 RELEASE,
        mode:                 "production",
        devtool:              false,
        minimize:             true,
        // O Terser paralelo forka a partir de process.execPath. Dentro do
        // binário empacotado isso depende de uma variável de ambiente herdada,
        // e a economia de tempo não paga a fragilidade. Ver o risco registrado.
        minimizeParallel:     false,
        transpileOnly:        false,
        applySourceMapLoader: false,
        cacheType:            false,
        watch:                false,
        watchPoll:            false,
        statsPreset:          "errors-warnings",
        maxOldSpaceMb:        2048,
        // Determinismo: um BUILD_DATE novo a cada compilação faz o bundle nunca
        // ser idêntico ao anterior, o que derruba qualquer cache de conteúdo.
        stableBuildDate:      true
    },

    // Desenvolvimento sem watch: compila uma vez, mas com mapa de código
    // barato, sem minificar e sem typecheck (o editor já faz isso).
    [DEBUG]: {
        name:                 DEBUG,
        mode:                 "development",
        devtool:              "eval-cheap-module-source-map",
        minimize:             false,
        minimizeParallel:     false,
        transpileOnly:        true,
        applySourceMapLoader: true,
        cacheType:            "filesystem",
        watch:                false,
        watchPoll:            false,
        statsPreset:          "errors-warnings",
        maxOldSpaceMb:        3072,
        stableBuildDate:      false
    },

    // Desenvolvimento ativo: igual ao debug, recompilando a cada alteração.
    [DEBUG_WATCH]: {
        name:                 DEBUG_WATCH,
        mode:                 "development",
        devtool:              "eval-cheap-module-source-map",
        minimize:             false,
        minimizeParallel:     false,
        transpileOnly:        true,
        applySourceMapLoader: true,
        cacheType:            "filesystem",
        watch:                true,
        watchPoll:            false,
        statsPreset:          "errors-warnings",
        maxOldSpaceMb:        3072,
        stableBuildDate:      false
    }
}

const ENV_PROFILE   = "META_WEBGUI_BUILD_PROFILE"
const ENV_WATCH_POLL = "META_WEBGUI_BUILD_WATCH_POLL_MS"
const ENV_ISOLATED  = "META_WEBGUI_BUILD_ISOLATED"
const ENV_MAX_OLD_SPACE = "META_WEBGUI_BUILD_MAX_OLD_SPACE_MB"

const _Warn = (message) => {
    if(globalThis.Log && globalThis.Log.warn) globalThis.Log.warn("BuildProfiles", message)
}

const IsKnownProfileName = (name) => PROFILE_NAMES.includes(name)

// Traduz o parâmetro legado. Enquanto os 14 `.webgui` do ecossistema não
// migrarem para `webguiBuildProfile`, `isWatch: true` continua significando
// "quero recompilar a cada alteração" — que é exatamente o perfil debug-watch.
//
// Note que só o booleano `true` conta: por causa da armadilha descrita no topo,
// um `isWatch: false` chega aqui como a string "isWatch". Tratar qualquer valor
// truthy como watch perpetuaria o defeito.
const MapLegacyIsWatch = (isWatch) => isWatch === true ? DEBUG_WATCH : undefined

// Resolve o perfil efetivo. NUNCA lança: um ecossistema instalado só recebe as
// chaves novas depois de um `ecosystem update`, e um nome desconhecido não pode
// ser a diferença entre "o parâmetro não pegou" e "nenhuma interface sobe".
const ResolveBuildProfile = ({
    profileName,
    isWatch,
    overrides = {},
    env = (typeof process !== "undefined" ? process.env : {}) || {}
} = {}) => {

    const envName = env[ENV_PROFILE]

    // Precedência: ambiente > parâmetro do pacote > isWatch legado > padrão.
    const requested = [envName, profileName, MapLegacyIsWatch(isWatch)]
        .find((candidate) => typeof candidate === "string" && candidate.length > 0)

    let resolvedName = DEFAULT_PROFILE_NAME

    if(requested){
        if(IsKnownProfileName(requested)) resolvedName = requested
        else _Warn(`perfil de build "${requested}" não existe; usando "${DEFAULT_PROFILE_NAME}". Conhecidos: ${PROFILE_NAMES.join(", ")}`)
    }

    if(!envName && !profileName && MapLegacyIsWatch(isWatch))
        _Warn(`o parâmetro "isWatch" está obsoleto; declare "webguiBuildProfile": "${DEBUG_WATCH}" no pacote`)

    const base = PROFILES[resolvedName]

    // O polling do watch é caro (um stat de toda a árvore por ciclo), mas é a
    // única forma de detectar alteração em volume montado, NFS ou container,
    // onde o inotify não propaga. Fica desligado por padrão e religável sem
    // reconstruir a plataforma.
    const watchPollMs = Number(env[ENV_WATCH_POLL])
    const watchPoll = Number.isFinite(watchPollMs) && watchPollMs > 0 ? watchPollMs : base.watchPoll

    const maxOldSpaceFromEnv = Number(env[ENV_MAX_OLD_SPACE])
    const maxOldSpaceMb = Number.isFinite(maxOldSpaceFromEnv) && maxOldSpaceFromEnv > 0
        ? maxOldSpaceFromEnv
        : base.maxOldSpaceMb

    return Object.freeze({ ...base, watchPoll, maxOldSpaceMb, ...overrides })
}

// Bandeira de três estados vinda de parâmetro: "off" desliga, qualquer outra
// coisa mantém o padrão. Existe porque `false` não sobrevive ao pipeline de
// parâmetros (ver o topo do arquivo).
const ResolveIsolationFlag = ({
    value,
    env = (typeof process !== "undefined" ? process.env : {}) || {}
} = {}) => {
    const raw = env[ENV_ISOLATED] !== undefined ? env[ENV_ISOLATED] : value
    if(typeof raw === "string") return raw.toLowerCase() !== "off"
    if(raw === false) return false
    return true
}

// Assinatura do perfil, para entrar no fingerprint do cache: trocar de perfil
// precisa invalidar o bundle, senão um `release` reaproveitaria o artefato
// gordo de um `debug` anterior.
const GetProfileFingerprintKey = (profile) => [
    profile.name,
    `dt:${profile.devtool || "none"}`,
    `min:${profile.minimize ? 1 : 0}`,
    `tso:${profile.transpileOnly ? 1 : 0}`,
    `sml:${profile.applySourceMapLoader ? 1 : 0}`
].join("|")

module.exports = {
    PROFILE_NAMES,
    DEFAULT_PROFILE_NAME,
    RELEASE,
    DEBUG,
    DEBUG_WATCH,
    IsKnownProfileName,
    MapLegacyIsWatch,
    ResolveBuildProfile,
    ResolveIsolationFlag,
    GetProfileFingerprintKey
}
