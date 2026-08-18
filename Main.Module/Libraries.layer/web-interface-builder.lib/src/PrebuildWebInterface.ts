// Caminho de entrada explícito para construir a webgui de um pacote FORA do
// ciclo de vida do serviço — antes dele existir, inclusive: numa etapa de
// build de imagem, ou num módulo dedicado que pré-constrói vários painéis de
// uma vez para outro módulo servir depois.
//
// `BuildWorkerEntry.ts` já aceita um `job.json` por argumento, mas ali isso é
// uma via de MEDIÇÃO (rodar um build isolado sem o pai no meio) — o formato do
// job é o do protocolo interno do worker (`smartRequirePath`, `params` em vez
// de campos nomeados, etc.), não uma interface pensada para ser escrita à mão.
// Este arquivo é a interface pensada para isso: os MESMOS dados que o
// `endpoint-instance.taskLoader` monta ao subir um endpoint
// "web-graphic-user-interface" (ver StartWebGraphicUserInterfaceService.ts),
// com nomes de campo que batem com `loaderParams`.
//
// O artefato que sai daqui só é achado em runtime se o NOME do diretório
// bater com o que o taskLoader calcula — por isso os dois usam a mesma conta
// (`OutputDirectory.ComputeOutputDirName`), nunca uma cópia local.

const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

// Campos que só existem em RUNTIME — o caminho de um módulo dentro de um
// ecossistema instalado, que este processo pode nem estar rodando dentro de
// (o caso comum: uma etapa de build de imagem, fora de qualquer ecossistema).
// Nenhum tem padrão inventado: sem eles, o comportamento correto é falhar
// cedo, não adivinhar um caminho que pode nem existir na máquina que chama.
type RuntimeOnlyInputs = {
    // Caminho ABSOLUTO do SmartRequire do essential. Sem ele não há como
    // resolver "webpack"/"html-webpack-plugin" a partir do node_modules do
    // pacote-alvo — exatamente o que SmartRequire existe para fazer.
    smartRequirePath: string
    // Caminho ABSOLUTO do instalador da resolução de TypeScript do essential.
    // OPCIONAL só porque um chamador que já rodou dentro do ecossistema (onde
    // o hook já foi instalado pelo processo pai) não precisa reinstalá-lo —
    // ver o comentário em `_InstallTypeScriptResolution` abaixo. Fora desse
    // caso, omiti-lo faz o `require("./WebInterfaceBuilder")` logo adiante
    // falhar em MODULE_NOT_FOUND: este arquivo é `.ts`, e sem o hook o Node
    // não sabe completar a extensão.
    installTypeScriptResolutionPath?: string
    // Caminho ABSOLUTO do instalador do logger global. Sem ele (e sem
    // `globalThis.Log` já presente) o build segue mudo — nunca falha por
    // causa disso, mas ninguém vê o progresso nem o resultado.
    installGlobalLoggerPath?: string
}

// Os MESMOS dados que `StartWebGraphicUserInterfaceService.ts` extrai de
// `loaderParams` — a diferença é que ali eles chegam prontos (o task
// executor já resolveu handles de pacote em caminhos), e aqui quem chama
// precisa fornecê-los explicitamente.
type PrebuildWebInterfaceConfig = RuntimeOnlyInputs & {
    // OBRIGATÓRIOS: sem eles não há o que compilar nem onde salvar.
    context: string            // caminho ABSOLUTO do pacote .webgui
    entrypoint: string         // relativo a `context`
    htmlTemplate: string       // relativo a `context`
    nodeModulesPath: string    // node_modules do pacote (react etc.)
    serverName: string         // nome do servidor/app — entra no artefato E no bundle
    environmentPath: string    // raiz onde o ambiente guarda dados gerados
    generatedDirName: string   // equivalente a RT_ENV_GENERATED_DIR_NAME em runtime

    // OPCIONAIS — mesmo default do runtime quando ausentes.
    url?: string                    // rota HTTP montada pelo server-manager (default: "")
    serverEndpointStatus?: string   // endereço do server-manager, baked no bundle (default: "")
    buildProfile?: string           // "release" (padrão), "debug" ou "debug-watch"
    buildEngine?: string            // motor de build (padrão: webpack)
    // Já no formato SERIALIZADO que `WebInterfaceBuilder` espera (o mesmo que
    // `SerializeComponentLibraries`/`SerializeWasmModules` produzem em
    // runtime) — este caminho não tem handles de pacote vivos para serializar.
    componentLibraries?: any[]
    wasmModules?: any[]
}

const REQUIRED_FIELDS = [
    "context", "entrypoint", "htmlTemplate", "nodeModulesPath",
    "serverName", "environmentPath", "generatedDirName", "smartRequirePath"
] as const

const _AssertRequiredFields = (config: any) => {
    const missing = REQUIRED_FIELDS.filter((field) => !config || !config[field])
    if(missing.length)
        throw new Error(`config incompleto para o pré-build da webgui: faltam ${missing.join(", ")}`)
}

// Ver BuildWorkerEntry.ts — mesma necessidade, mesmo motivo: este processo
// pode não ter a resolução de `.ts` instalada (não há garantia de que roda
// dentro do package-executor), e o `require("./WebInterfaceBuilder")` logo
// abaixo é por caminho SEM extensão. Precisa acontecer ANTES desse require —
// por isso não há um `require` de topo de arquivo para `./WebInterfaceBuilder`
// neste módulo, ao contrário dos outros arquivos do pacote.
const _InstallTypeScriptResolution = (installTypeScriptResolutionPath?: string) => {
    if(!installTypeScriptResolutionPath) return
    try { require(path.resolve(installTypeScriptResolutionPath))() }
    catch(e) { /* hook já instalado pelo processo pai, ou essential anterior a ele */ }
}

const _InstallLogger = (installGlobalLoggerPath?: string) => {
    if(globalThis.Log) return
    if(installGlobalLoggerPath){
        try {
            require(path.resolve(installGlobalLoggerPath))({ origin: "prebuild-web-interface", disableFileSink: true })
            return
        } catch(e) { /* segue para o fallback de console */ }
    }
    const _log = (...args: any[]) => console.log(...args)
    globalThis.Log = { info: _log, warn: _log, error: (...a: any[]) => console.error(...a), message: _log, child: () => globalThis.Log, source: () => globalThis.Log } as any
}

const PrebuildWebInterface = async (config: PrebuildWebInterfaceConfig): Promise<{ output: string, summary: any, fromCache: boolean, profileName?: string }> => {

    _AssertRequiredFields(config)
    _InstallTypeScriptResolution(config.installTypeScriptResolutionPath)
    _InstallLogger(config.installGlobalLoggerPath)

    // Ambos por caminho, e SÓ AGORA: antes da resolução de TypeScript instalada
    // acima, nem `./WebInterfaceBuilder` (extensionless) resolveria.
    const CreateWebInterfaceBuilder = require("./WebInterfaceBuilder")

    const {
        context, entrypoint, htmlTemplate, nodeModulesPath,
        serverName, environmentPath, generatedDirName, smartRequirePath,
        // `url` (a rota de montagem) NÃO entra aqui: este caminho só compila —
        // quem serve o artefato depois é que decide onde montar a rota. Fica
        // documentado no tipo por completude (é o mesmo dado que o taskLoader
        // recebe), não porque o build precise dele.
        serverEndpointStatus = "",
        buildProfile, buildEngine,
        componentLibraries = [], wasmModules = []
    } = config

    const SmartRequire = require(path.resolve(smartRequirePath))
    const WebInterfaceBuilder = CreateWebInterfaceBuilder(SmartRequire)
    const { BuildProfiles, OutputDirectory } = WebInterfaceBuilder

    const profile = BuildProfiles.ResolveBuildProfile({ profileName: buildProfile })

    // Um pré-build existe para produzir UM artefato e parar — "observar e
    // recompilar" não tem sentido fora do ciclo de vida de um serviço vivo, e
    // rodando aqui ficaria preso para sempre sem ninguém para fechar o watch.
    if(profile.watch)
        throw new Error(
            `pré-build não aceita o perfil "${profile.name}" (observa e nunca termina) — use "release" ou "debug"`
        )

    const profileKey = BuildProfiles.GetProfileFingerprintKey(profile)

    // MESMA conta que `StartWebGraphicUserInterfaceService.ts` faz em runtime:
    // é o que garante que o artefato construído aqui seja achado lá.
    const outputDirName = OutputDirectory.ComputeOutputDirName({
        serverAppName: serverName, entrypoint, htmlTemplate, profileKey, buildEngine
    })
    const output = OutputDirectory.MountOutputDirPath({ environmentPath, outputDirName, generatedDirName })

    const builder = await WebInterfaceBuilder({
        entrypoint, htmlTemplate, context, nodeModulesPath, output,
        // O `url` que o WebInterfaceBuilder baked no bundle é o endereço do
        // server-manager (`serverEndpointStatus`), não a rota de montagem —
        // mesma troca de nome que `StartWebGraphicUserInterfaceService.ts` faz.
        url: serverEndpointStatus,
        serverAppName: serverName,
        componentLibraries, wasmModules,
        buildProfile, buildEngine,
        environmentPath, generatedDirName,
        // Já é um processo à parte, lançado FORA do ciclo de vida do serviço —
        // isolar de novo não devolveria memória a ninguém que precise dela.
        isolateBuild: false
    })

    // Devolve a MESMA forma que `builder.Build()` já devolve — `fromCache` e
    // `profileName` vivem no NÍVEL DE FORA de `summary`, não dentro dela (só o
    // caminho de acerto de cache dentro do builder duplica `fromCache` para
    // dentro do resumo; um build novo não).
    const result = await builder.Build()
    return { output: result.output, summary: result.summary, fromCache: !!result.fromCache, profileName: result.profileName }
}

// Modo linha de comando: `node PrebuildWebInterface.ts <config.json>`.
//
//     {
//       "context": "/abs/pacote/.webgui/src",
//       "entrypoint": "index.tsx",
//       "htmlTemplate": "index.html",
//       "nodeModulesPath": "/abs/pacote/.webgui/node_modules",
//       "serverName": "meu-painel",
//       "environmentPath": "/abs/ambiente",
//       "generatedDirName": ".generated_data",
//       "smartRequirePath": "/abs/essential/.../SmartRequire",
//       "installTypeScriptResolutionPath": "/abs/essential/.../InstallTypeScriptResolution",
//       "buildProfile": "release"
//     }
if(require.main === module){
    const configFile = process.argv[2]
    if(!configFile){
        console.error("uso: node PrebuildWebInterface.ts <config.json>")
        process.exit(2)
    }
    const config = JSON.parse(fs.readFileSync(path.resolve(configFile), "utf8"))
    PrebuildWebInterface(config)
        .then(({ output, summary, fromCache }) => {
            console.log(`webgui de "${config.serverName}" pronta em ${output}${fromCache ? " (cache)" : ""}`)
            process.exit(summary.ok === false ? 1 : 0)
        })
        .catch((error) => {
            console.error(`falha no pré-build da webgui: ${error.message}`)
            process.exit(1)
        })
}

module.exports = PrebuildWebInterface
module.exports.REQUIRED_FIELDS = REQUIRED_FIELDS
