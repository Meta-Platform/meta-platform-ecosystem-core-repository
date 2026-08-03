/*
    Teste do gate de autorização do export (VDRP-195) — FIXTURES ISOLADAS.

    NENHUM export real é executado: o adapter do runtime é um duplo que devolve
    um base64 sentinela. Se esse sentinela aparecer numa resposta que deveria ter
    sido recusada, o teste falha — é assim que se prova que o payload não sai.

    Cobre:
    - 401 UNAUTHENTICATED: sem authenticationData, e com objeto vazio
    - 403 PERMISSION_DENIED: usuário autenticado que o PDP nega
    - 403 AUTHORIZATION_UNAVAILABLE: PDP inalcançável, PEP não configurado e
      WAITING_FOR_IAM — os três negam, porque para ação crítica a falta de
      infraestrutura de autorização é recusa, não liberação
    - sucesso autorizado: só aí o base64 é produzido
    - o adapter NÃO é chamado nos casos recusados (o export nem começa)
    - auditoria: allow e deny registrados com ator, ação, recurso e motivo, e
      sem nunca registrar o conteúdo exportado
    - os três Export* têm o mesmo comportamento
    - api.json declara 2+ params nos Export* (senão authenticationData não chega)

    Uso:  node scripts/test-export-authorization.js
*/
const { readFileSync } = require("fs")
const { join, resolve } = require("path")

const ContainerOrchestratorController = require("../src/Controllers/ContainerOrchestrator.controller")
const CreateExportAuthorizationGuard = require("../src/Helpers/CreateExportAuthorizationGuard")
const { EXPORT_PERMISSION } = CreateExportAuthorizationGuard

/*
    A authorization-client.lib (o PEP) vive no VirtualDeskRepo, não aqui: este
    webservice a recebe por injeção e roda sem ela. O teste, porém, quer o PEP
    REAL — provar o gate contra um duplo do próprio gate não prova nada. Então
    procura a lib nos lugares onde ela costuma estar; se não achar, o teste
    PARA com instrução, em vez de passar sem ter exercitado o PEP.
*/
const CANDIDATOS_DA_LIB_DE_AUTORIZACAO = [
    process.env.AUTHORIZATION_CLIENT_LIB_PATH,
    resolve(__dirname, "../../../../../../thrid-party-repos/virtual-desk-repository/Platform.Module/Libraries.layer/authorization-client.lib"),
    resolve(__dirname, "../../../../../VirtualDeskRepo/Platform.Module/Libraries.layer/authorization-client.lib")
].filter(Boolean)

const ResolveAuthorizationClient = () => {
    for (const raiz of CANDIDATOS_DA_LIB_DE_AUTORIZACAO) {
        try {
            return require(join(raiz, "src", "CreateAuthorizationClient"))
        } catch (error) {
            if (error.code !== "MODULE_NOT_FOUND") throw error
        }
    }
    console.error(
        "\nauthorization-client.lib não encontrada.\n" +
        "Aponte AUTHORIZATION_CLIENT_LIB_PATH para o diretório da lib no VirtualDeskRepo\n" +
        "e rode de novo. Procurado em:\n  " +
        CANDIDATOS_DA_LIB_DE_AUTORIZACAO.join("\n  ") + "\n"
    )
    process.exit(1)
}

const CreateAuthorizationClient = ResolveAuthorizationClient()

// Se este valor aparecer numa resposta recusada, houve vazamento.
const BASE64_SENTINELA = "U0VOVElORUxBX0RPX0ZJTEVTWVNURU1fRVhQT1JUQURP"

let failures = 0
const ok = (cond, msg) => {
    console.log(`${cond ? "  OK   " : "  FALHA"} ${msg}`)
    if (!cond) failures++
}

const USUARIO = { username: "kaio", userId: "u-1" }

/*
    Monta o controller real com duplos controláveis:
    - `decisao`: o que o PDP responde (ou "erro" para simular indisponibilidade)
    - `comPEP`: se a lib de autorização é vinculada
    - `comSocketIAM`: se o socket do IAM foi configurado
*/
const MountController = ({ decisao = { decision: "ALLOW", reason: "RBAC_PERMISSION" }, comPEP = true, comSocketIAM = true } = {}) => {
    const chamadasDoAdapter = []
    const eventos = []

    const commandExecutorLib = {
        require: () => async ({ mainApplicationSocketPath, CommandFunction }) => {
            // O mesmo executor atende runtime e IAM; distingue pelo socket.
            if (mainApplicationSocketPath === "/tmp/iam-falso.sock") {
                if (decisao === "erro") throw new Error("socket do IAM indisponível")
                return CommandFunction({
                    APIs: { IAMAppInstance: { AuthorizationManagement: { Evaluate: async () => decisao } } }
                })
            }
            const API = {
                ExportImage: async ({ imageIdOrName }) => { chamadasDoAdapter.push(`ExportImage:${imageIdOrName}`); return BASE64_SENTINELA },
                ExportContainer: async ({ containerIdOrName }) => { chamadasDoAdapter.push(`ExportContainer:${containerIdOrName}`); return BASE64_SENTINELA },
                ExportVolume: async ({ volumeName }) => { chamadasDoAdapter.push(`ExportVolume:${volumeName}`); return BASE64_SENTINELA },
                ListAllContainers: async () => []
            }
            return CommandFunction({ APIs: { ContainerRuntimeAdapterInstance: { ContainerRuntime: API } } })
        }
    }

    const controller = ContainerOrchestratorController({
        commandExecutorLib,
        containerRuntimeSocketPath: "/tmp/runtime-falso.sock",
        containerRuntimeServerManagerUrl: "/server-manager/status",
        authorizationClientLib: comPEP ? { require: () => CreateAuthorizationClient } : undefined,
        iamManagerSocketPath: comSocketIAM ? "/tmp/iam-falso.sock" : undefined,
        iamManagerServerManagerUrl: "/server-manager/status",
        auditManagerService: { RecordEvent: (evento) => eventos.push(evento) }
    })

    return { controller, chamadasDoAdapter, eventos }
}

const Recusa = async (fn) => {
    try {
        const resultado = await fn()
        return { recusou: false, resultado }
    } catch (error) {
        return { recusou: true, code: error.code, httpStatus: error.httpStatus, message: error.message, detail: error.detail }
    }
}

const main = async () => {

    // ---- 401 ----
    console.log("401 — sem usuário autenticado")
    {
        const { controller, chamadasDoAdapter } = MountController()
        const sem = await Recusa(() => controller.ExportImage({ imageIdOrName: "img-1", reason: "quero baixar" }))
        ok(sem.recusou && sem.code === "UNAUTHENTICATED" && sem.httpStatus === 401,
            `sem authenticationData → ${sem.code}/${sem.httpStatus}`)
        ok(chamadasDoAdapter.length === 0, "o adapter NÃO foi chamado: o export nem começou")
        ok(!JSON.stringify(sem).includes(BASE64_SENTINELA), "nenhum base64 na resposta recusada")

        const vazio = await Recusa(() => controller.ExportContainer({ containerIdOrName: "c-1", reason: "r" }, { authenticationData: {} }))
        ok(vazio.recusou && vazio.code === "UNAUTHENTICATED", "authenticationData vazio também é 401")

        const semArgs = await Recusa(() => controller.ExportVolume())
        ok(semArgs.recusou && semArgs.code === "UNAUTHENTICATED", "chamada sem argumento nenhum é 401 (não explode)")
    }

    // ---- 403 sem permissão ----
    console.log("\n403 — autenticado, sem permissão")
    {
        const { controller, chamadasDoAdapter, eventos } = MountController({
            decisao: { decision: "DENY", reason: "DEFAULT_DENY" }
        })
        const negado = await Recusa(() => controller.ExportImage({ imageIdOrName: "img-1", reason: "auditoria" }, { authenticationData: USUARIO }))
        ok(negado.recusou && negado.code === "PERMISSION_DENIED" && negado.httpStatus === 403,
            `PDP nega → ${negado.code}/${negado.httpStatus}`)
        ok(negado.message.includes(EXPORT_PERMISSION), `a mensagem diz qual permissão falta (${EXPORT_PERMISSION})`)
        ok(negado.detail === "DEFAULT_DENY", "o motivo do PDP é preservado no detalhe")
        ok(chamadasDoAdapter.length === 0, "o adapter NÃO foi chamado")
        ok(!JSON.stringify(negado).includes(BASE64_SENTINELA), "nenhum base64 na resposta recusada")

        const deny = eventos.find((e) => e.decision === "deny")
        ok(deny !== undefined && deny.actorUsername === "kaio" && deny.action === EXPORT_PERMISSION,
            "recusa auditada com ator e ação")
        ok(deny.resource === "image/img-1", `recurso auditado (${deny?.resource})`)
        ok(!JSON.stringify(eventos).includes(BASE64_SENTINELA), "a auditoria não registra o conteúdo exportado")
    }

    // ---- 403 por indisponibilidade ----
    console.log("\n403 — sem como avaliar a autorização (fail-closed)")
    {
        const { controller, chamadasDoAdapter } = MountController({ decisao: "erro" })
        const indisponivel = await Recusa(() => controller.ExportImage({ imageIdOrName: "img-1", reason: "r" }, { authenticationData: USUARIO }))
        ok(indisponivel.recusou && indisponivel.code === "AUTHORIZATION_UNAVAILABLE" && indisponivel.httpStatus === 403,
            `PDP inalcançável → ${indisponivel.code}/${indisponivel.httpStatus}`)
        ok(chamadasDoAdapter.length === 0, "adapter não chamado com o PDP fora")
    }
    {
        const { controller } = MountController({ comPEP: false })
        const semLib = await Recusa(() => controller.ExportImage({ imageIdOrName: "i", reason: "r" }, { authenticationData: USUARIO }))
        ok(semLib.recusou && semLib.code === "AUTHORIZATION_UNAVAILABLE",
            "PEP não vinculado no boot → export negado (não liberado)")
        ok(controller.GetExportGuardState().configured === false, "o estado do gate expõe que não está configurado")
    }
    {
        const { controller } = MountController({ comSocketIAM: false })
        const semSocket = await Recusa(() => controller.ExportImage({ imageIdOrName: "i", reason: "r" }, { authenticationData: USUARIO }))
        ok(semSocket.recusou && semSocket.code === "AUTHORIZATION_UNAVAILABLE",
            "socket do IAM ausente → export negado")
    }
    {
        // WAITING_FOR_IAM (VDRP-131): o PEP nunca alcançou o PDP.
        const guard = CreateExportAuthorizationGuard({
            CreateAuthorizationClientFunction: CreateAuthorizationClient,
            EvaluateFunction: async () => { throw new Error("IAM ainda não subiu") }
        })
        const esperando = await Recusa(() => guard.AssertCanExport({ authenticationData: USUARIO, resource: "image/i" }))
        ok(esperando.recusou && esperando.code === "AUTHORIZATION_UNAVAILABLE",
            "WAITING_FOR_IAM → export negado")
        ok(guard.GetGuardState().failMode === "closed",
            "o gate usa failMode closed, não o open padrão de leitura")
    }

    // ---- sucesso ----
    console.log("\nSUCESSO — autenticado e autorizado")
    {
        const { controller, chamadasDoAdapter, eventos } = MountController()
        const imagem = await controller.ExportImage({ imageIdOrName: "img-1", reason: "cópia para análise" }, { authenticationData: USUARIO })
        ok(imagem === BASE64_SENTINELA, "com permissão, o export acontece e devolve o payload")
        ok(chamadasDoAdapter.includes("ExportImage:img-1"), "o adapter foi chamado com o alvo correto")

        const allow = eventos.find((e) => e.decision === "allow")
        ok(allow !== undefined && allow.reason === "cópia para análise",
            "o motivo informado pelo operador vai para a auditoria")
        ok(allow.actorUserId === "u-1" && allow.resource === "image/img-1", "ator e recurso auditados no allow")

        const container = await controller.ExportContainer({ containerIdOrName: "c-9", reason: "r" }, { authenticationData: USUARIO })
        const volume = await controller.ExportVolume({ volumeName: "v-3", reason: "r" }, { authenticationData: USUARIO })
        ok(container === BASE64_SENTINELA && volume === BASE64_SENTINELA, "os três Export* funcionam autorizados")
        ok(chamadasDoAdapter.includes("ExportContainer:c-9") && chamadasDoAdapter.includes("ExportVolume:v-3"),
            "alvo correto em container e volume")
    }

    // ---- os três têm o MESMO comportamento sob recusa ----
    console.log("\nCONSISTÊNCIA ENTRE OS TRÊS EXPORT*")
    {
        const { controller, chamadasDoAdapter } = MountController({ decisao: { decision: "DENY", reason: "DEFAULT_DENY" } })
        const resultados = [
            await Recusa(() => controller.ExportImage({ imageIdOrName: "i", reason: "r" }, { authenticationData: USUARIO })),
            await Recusa(() => controller.ExportContainer({ containerIdOrName: "c", reason: "r" }, { authenticationData: USUARIO })),
            await Recusa(() => controller.ExportVolume({ volumeName: "v", reason: "r" }, { authenticationData: USUARIO }))
        ]
        ok(resultados.every((r) => r.recusou && r.code === "PERMISSION_DENIED"), "os três negam igual")
        ok(chamadasDoAdapter.length === 0, "nenhum dos três chegou ao adapter")
    }

    // ---- contrato do api.json ----
    console.log("\nCONTRATO DO api.json")
    {
        const api = JSON.parse(readFileSync(join(__dirname, "..", "src", "APIs", "ContainerOrchestrator.api.json"), "utf8"))
        const exports_ = api.endpoints.filter((e) => e.summary.startsWith("Export"))
        ok(exports_.length === 3, `três endpoints de export declarados (${exports_.length})`)
        ok(exports_.every((e) => (e.parameters ?? []).length >= 2),
            "cada Export* declara 2+ params — com 1 o handler receberia posicional e authenticationData não chegaria")
        ok(exports_.every((e) => e.parameters.some((p) => p.name === "reason")),
            "o motivo é parâmetro declarado, é o que a auditoria registra")
    }

    console.log(`\n${failures === 0 ? "TODOS OS CRITÉRIOS PASSARAM" : `${failures} FALHA(S)`}`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
    console.error("ERRO:", error)
    process.exit(1)
})
