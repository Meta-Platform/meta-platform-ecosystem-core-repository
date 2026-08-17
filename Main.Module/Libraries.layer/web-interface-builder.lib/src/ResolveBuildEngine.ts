const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

// Os motores são carregados por CAMINHO porque este módulo também roda dentro do
// worker de build, um processo novo onde a resolução de `.ts` da plataforma pode
// ainda não estar instalada quando o arquivo é lido.
const _RequireEngine = (fileName: string) => {
    const base = path.join(__dirname, "BuildEngines", fileName)
    return require([`${base}.js`, `${base}.ts`].find((candidate) => fs.existsSync(candidate)) ?? base)
}

const WEBPACK = "webpack"

// Registro aberto de motores de construção de interface.
//
// Até aqui o webpack não era uma escolha: era a única estratégia possível, com a
// configuração e o ciclo de vida do compilador espalhados pelo builder e
// duplicados no worker. Ele agora é UM motor entre outros, e acrescentar o
// próximo é acrescentar uma linha aqui mais um módulo em `BuildEngines/`.
//
// O que um motor precisa oferecer está descrito em `BuildEngines/WebpackEngine.ts`:
// `name` e `CreateSession({ params, profile })`, com a sessão respondendo a
// `RunOnce()`, `StartWatch({ onCycle })` e `Close()`.
//
// Candidatos previstos, e por que nesta ordem:
//
// - **rspack** — webpack reescrito em Rust, com API e configuração compatíveis.
//   É a troca de maior retorno com menor risco: mantém a semântica dos webguis
//   existentes e tira o trabalho de dentro do heap do V8.
// - **esbuild** — para interfaces que não dependem de loaders específicos. A API
//   Node dele já executa o compilador como processo filho, então o build nunca
//   infla o heap do serviço. Em troca não faz checagem de tipos e não emite ES5,
//   o que exige subir o `target` dos tsconfig das webguis. É mudança de
//   comportamento, e precisa ser decidida — não descoberta.
const ENGINE_FILES: Record<string, string> = {
    [WEBPACK]: "WebpackEngine"
}

const ENGINE_NAMES = Object.keys(ENGINE_FILES)

const DEFAULT_ENGINE_NAME = WEBPACK

const ENV_ENGINE = "META_WEBGUI_BUILD_ENGINE"

// Precedência igual à do perfil de build: variável de ambiente vence o parâmetro,
// que vence o padrão. Quem opera uma instalação precisa conseguir forçar o motor
// sem reprovisionar todo mundo.
const ResolveBuildEngineName = ({
    engineName,
    env = (typeof process !== "undefined" ? process.env : {}) || {}
}: {
    engineName?: unknown
    env?: Record<string, string | undefined>
} = {}): string => {

    const escolhido = env[ENV_ENGINE] !== undefined ? env[ENV_ENGINE] : engineName

    if(typeof escolhido !== "string" || escolhido.trim() === "") return DEFAULT_ENGINE_NAME

    const normalizado = escolhido.trim().toLowerCase()

    // Nome desconhecido FALHA, e falha aqui. Cair no padrão em silêncio faria um
    // erro de digitação no metadado virar "o motor novo não mudou nada" — e a
    // investigação começaria no lugar errado.
    if(!ENGINE_FILES[normalizado])
        throw new Error(
            `Motor de build de interface desconhecido: "${escolhido}". Conhecidos: ${ENGINE_NAMES.join(", ")}`
        )

    return normalizado
}

const ResolveBuildEngine = ({
    engineName,
    SmartRequire,
    env
}: {
    engineName?: unknown
    SmartRequire: (moduleName: string) => any
    env?: Record<string, string | undefined>
}) => {
    const nome = ResolveBuildEngineName({ engineName, env })
    return _RequireEngine(ENGINE_FILES[nome])(SmartRequire)
}

ResolveBuildEngine.ResolveBuildEngineName = ResolveBuildEngineName
ResolveBuildEngine.ENGINE_NAMES           = ENGINE_NAMES
ResolveBuildEngine.DEFAULT_ENGINE_NAME    = DEFAULT_ENGINE_NAME

module.exports = ResolveBuildEngine
