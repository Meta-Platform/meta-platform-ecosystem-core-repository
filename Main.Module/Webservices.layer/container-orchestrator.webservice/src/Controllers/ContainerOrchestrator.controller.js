const SanitizeContainerRuntimePayload = require("../Helpers/SanitizeContainerRuntimePayload")
const CreateExportAuthorizationGuard = require("../Helpers/CreateExportAuthorizationGuard")
const CreateAuditRecorder = require("../Helpers/CreateAuditRecorder")

const CONTAINER_RUNTIME_SERVER_NAME = "ContainerRuntimeAdapterInstance"
const CONTAINER_RUNTIME_API_NAME = "ContainerRuntime"

const IAM_SERVER_NAME = "IAMAppInstance"

const IsUsablePath = (value) =>
    typeof value === "string" && value.length > 0 && !value.startsWith("{{")

/*
    VDRP-199 — mutações do runtime (remove/start/stop/restart/kill de
    container, criação/remoção de rede e volume, conexão de rede, remoção de
    imagem) não têm gate de autorização (isso é escopo de outro item, como
    VDRP-195 fez para Export*): aqui só se AUDITA quem fez o quê. Por isso a
    recusa possível é só "sem usuário autenticado" — defensivo, já que
    `needsAuth` no boot já deveria barrar isso antes de chegar aqui, mesmo
    espírito de `CreateExportAuthorizationGuard.Unauthenticated`.
*/
class MutationRefusedError extends Error {
    constructor(message) {
        super(message)
        this.name = "MutationRefusedError"
        this.code = "UNAUTHENTICATED"
        this.httpStatus = 401
        this.statusCode = 401
    }
}

/*
    ADAPTER FORA DO AR VIRA MENSAGEM, NÃO "status code 500" (VDRP-218).

    O que o operador via na aba Containers era `Request failed with status code
    500`, sem uma palavra sobre a causa. A causa real é sempre a mesma família:
    o socket do container-runtime-adapter existe como arquivo mas não tem quem
    escute do outro lado (ECONNREFUSED), ou o caminho sumiu (ENOENT). Isso
    acontece quando o arquivo de socket no volume compartilhado é substituído
    por um ciclo de vida de instância — o processo segue vivo, o estado segue
    dizendo RUNNING/ACTIVE, e ninguém percebe até a tela quebrar.

    Traduzir aqui não conserta o socket; faz o painel dizer O QUE aconteceu e o
    que fazer, em vez de exibir um número. A prevenção de verdade (não deixar o
    arquivo ser trocado sob o listener vivo) mora no ciclo de vida de socket do
    ecosystem core, fora deste repositório.
*/
const SOCKET_ERROR_CODES = new Set(["ECONNREFUSED", "ENOENT", "EACCES", "ECONNRESET", "EPIPE"])

const DescribesSocketFailure = (error) => {
    if (!error) return false
    if (SOCKET_ERROR_CODES.has(error.code)) return true
    const texto = `${error.message ?? ""}`
    return [...SOCKET_ERROR_CODES].some((code) => texto.includes(code))
}

class ContainerRuntimeUnavailableError extends Error {
    constructor(causa) {
        super(
            "O adaptador de runtime de containers não está respondendo no socket. " +
            "O serviço pode estar parado, ou o arquivo de socket ficou órfão depois de um " +
            "ciclo de vida de instância. Reiniciar (re-provisionar) o container-runtime-adapter " +
            "recria o socket.")
        this.name = "ContainerRuntimeUnavailableError"
        this.code = "CONTAINER_RUNTIME_UNAVAILABLE"
        this.httpStatus = 503
        this.statusCode = 503
        this.cause = causa
    }
}

const TranslateRuntimeUnavailability = (error) =>
    DescribesSocketFailure(error) ? new ContainerRuntimeUnavailableError(error) : error

// Cliente do container-runtime-adapter construído AQUI, no controller (lazy, por
// chamada) — mesmo padrão do repository-manager.webservice. Antes o cliente era
// registrado como um service-instance no boot.json do painel
// (@@/container-runtime-adapter-service / ContainerRuntimeClient). Esse
// service-instance TRAVA no start do package-executor (fica em STARTING e nunca
// fica ACTIVE, antes mesmo de carregar o módulo do cliente), o que impedia este
// endpoint de montar e o painel de listar containers ("Nenhum container
// encontrado"). Montando o cliente dentro do controller via commandExecutorLib, o
// endpoint deixa de depender daquele service-instance e sobe normalmente.
const ContainerOrchestratorController = (params) => {

    const {
        commandExecutorLib,
        containerRuntimeSocketPath,
        containerRuntimeServerManagerUrl,
        authorizationClientLib,
        iamManagerSocketPath,
        iamManagerServerManagerUrl,
        auditManagerService
    } = params

    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const ContainerRuntimeCommand = async (CommandFunction) => {
        const APICommandFunction = async ({ APIs }) => {
            const API = APIs[CONTAINER_RUNTIME_SERVER_NAME][CONTAINER_RUNTIME_API_NAME]
            return await CommandFunction(API)
        }

        try {
            return await CommandExecutor({
                serverResourceEndpointPath: containerRuntimeServerManagerUrl,
                mainApplicationSocketPath: containerRuntimeSocketPath,
                CommandFunction: APICommandFunction
            })
        } catch (error) {
            throw TranslateRuntimeUnavailability(error)
        }
    }

    /*
        VDRP-194: toda resposta de LEITURA do runtime passa pela sanitização
        antes de sair do BFF — valor de variável com nome de segredo é
        mascarado e caminho do host não sai. Envolver o comando (em vez de
        sanitizar caso a caso) garante que endpoint novo de leitura nasça
        protegido.
    */
    const SanitizedContainerRuntimeCommand = async (CommandFunction) =>
        SanitizeContainerRuntimePayload(await ContainerRuntimeCommand(CommandFunction))

    /*
        VDRP-195 — gate de autorização do export.

        O PEP (authorization-client.lib) consulta o PDP do IAM pelo socket. Tanto
        a lib quanto o socket são opcionais no boot; quando faltam, o gate nega
        todo export, porque para uma ação crítica a ausência de infraestrutura
        de autorização é motivo de recusa, não de liberação.
    */
    const MountEvaluateFunction = () => {
        if (!IsUsablePath(iamManagerSocketPath)) return undefined
        return async (request) => CommandExecutor({
            serverResourceEndpointPath: iamManagerServerManagerUrl,
            mainApplicationSocketPath: iamManagerSocketPath,
            CommandFunction: async ({ APIs }) =>
                APIs[IAM_SERVER_NAME].AuthorizationManagement.Evaluate(request)
        })
    }

    /*
        VDRP-199 — `auditManagerService` é bound-param OPCIONAL e, hoje, nunca é
        vinculado em nenhum boot.json do ecossistema: antes desta troca o Export*
        auditava para um sink sempre `undefined` (nenhum evento era persistido em
        lugar nenhum, apesar do RecordDecision existir desde VDRP-195). O
        AuditRecorder cai no mesmo canal remoto que HostActions.controller.js já
        usa (identity-and-access-core.app expõe AuditManagement.RecordEvent pelo
        socket do IAM) quando não há serviço local — ver CreateAuditRecorder.js.
    */
    const AuditRecorder = CreateAuditRecorder({
        auditManagerService,
        commandExecutorLib,
        iamManagerSocketPath,
        iamManagerServerManagerUrl,
        logPrefix: "container-orchestrator"
    })

    const ExportGuard = CreateExportAuthorizationGuard({
        CreateAuthorizationClientFunction: authorizationClientLib
            ? authorizationClientLib.require("CreateAuthorizationClient")
            : undefined,
        EvaluateFunction: MountEvaluateFunction(),
        Audit: AuditRecorder.RecordEvent
    })

    /*
        Envolve uma mutação do runtime (remove/start/stop/restart/kill/
        create/connect) para auditar SEMPRE: ator, ação, recurso e decisão —
        "deny" se não há usuário (defensivo), "allow" se o comando do adapter
        retornou, "error" se ele lançou (o `reason` é a mensagem de erro do
        adapter, nunca o payload da operação). A auditoria nunca decide se a
        operação acontece (não há gate aqui — só trilha); só a falta de
        usuário autenticado interrompe, espelhando o mesmo cuidado defensivo
        do ExportGuard.
    */
    const AuditedMutation = (action, resourcePrefix, ExtractTarget, CommandFunction) =>
        async (rawParams, { authenticationData } = {}) => {
            const target = ExtractTarget(rawParams)
            const resource = `${resourcePrefix}/${target ?? ""}`

            if (!authenticationData || (!authenticationData.username && !authenticationData.userId)) {
                AuditRecorder.RecordDecision({
                    authenticationData, eventType: "container_runtime.mutation",
                    action, resource, decision: "deny", reason: "UNAUTHENTICATED"
                })
                throw new MutationRefusedError(`${action} exige usuário autenticado.`)
            }

            try {
                const result = await CommandFunction(rawParams)
                AuditRecorder.RecordDecision({
                    authenticationData, eventType: "container_runtime.mutation",
                    action, resource, decision: "allow", reason: null
                })
                return result
            } catch (error) {
                AuditRecorder.RecordDecision({
                    authenticationData, eventType: "container_runtime.mutation",
                    action, resource, decision: "error", reason: error.message
                })
                throw error
            }
        }

    /*
        Os três Export* declaram DOIS parâmetros no api.json (o alvo e o
        motivo). Isso é deliberado: com um único parâmetro declarado o handler
        receberia argumento POSICIONAL e o `authenticationData` injetado pelo
        needsAuth nunca chegaria — sem ele não há quem autorizar. O motivo, além
        de forçar a forma-objeto, é o que a auditoria registra.
    */
    /*
        A assinatura é (params, { authenticationData }) — DOIS argumentos, não um
        objeto só. É assim que o framework chama o handler quando o api.json
        declara 2+ params (server-manager.service/src/Helpers/CreateAPIEndpointsService.js:63:
        `service[summary](params, authenticationData ? { authenticationData } : undefined)`).
        A forma anterior, `({ authenticationData, ...rest })`, lia o ator de
        dentro de `params` — onde ele nunca esteve — e o gate negava TODO export
        com 401. Fail-closed, então não houve vazamento; a função é que ficou
        inutilizável. Corrigido em VDRP-196, que verificou o contrato no fonte
        do framework.
    */
    const AuthorizedExport = (resourcePrefix, ExtractTarget, CommandFunction) =>
        async (params = {}, { authenticationData } = {}) => {
            const { reason, ...rest } = params
            const target = ExtractTarget(rest)
            await ExportGuard.AssertCanExport({
                authenticationData,
                resource: `${resourcePrefix}/${target ?? ""}`,
                reason
            })
            return CommandFunction(target)
        }

    const controllerServiceObject = {
        controllerName                 : "ContainerOrchestratorController",
        ListContainers                 : () => SanitizedContainerRuntimeCommand((API) => API.ListAllContainers()),
        ListImages                     : () => SanitizedContainerRuntimeCommand((API) => API.ListAllImages()),
        ListNetworks                   : () => SanitizedContainerRuntimeCommand((API) => API.ListAllNetworks()),
        ListVolumes                    : () => SanitizedContainerRuntimeCommand((API) => API.ListAllVolumes()),
        // VDRP-199: as mutações abaixo (remove/start/stop/restart/kill de
        // container, rede e volume; conexão de rede; remoção de imagem) passam
        // por AuditedMutation — sem gate de autorização (fora de escopo aqui),
        // só trilha de quem fez o quê, com allow/error e nunca o payload.
        RemoveContainer                : AuditedMutation("container:remove", "container",
                                            (containerIdOrName) => containerIdOrName,
                                            (containerIdOrName) => ContainerRuntimeCommand((API) => API.RemoveContainer({ containerIdOrName }))),
        StartContainer                 : AuditedMutation("container:start", "container",
                                            (containerIdOrName) => containerIdOrName,
                                            (containerIdOrName) => ContainerRuntimeCommand((API) => API.StartContainer({ containerIdOrName }))),
        StopContainer                  : AuditedMutation("container:stop", "container",
                                            (containerIdOrName) => containerIdOrName,
                                            (containerIdOrName) => ContainerRuntimeCommand((API) => API.StopContainer({ containerIdOrName }))),
        RestartContainer               : AuditedMutation("container:restart", "container",
                                            (containerIdOrName) => containerIdOrName,
                                            (containerIdOrName) => ContainerRuntimeCommand((API) => API.RestartContainer({ containerIdOrName }))),
        KillContainer                  : AuditedMutation("container:kill", "container",
                                            (containerIdOrName) => containerIdOrName,
                                            (containerIdOrName) => ContainerRuntimeCommand((API) => API.KillContainer({ containerIdOrName }))),
        InspectContainer               : (containerIdOrName) => SanitizedContainerRuntimeCommand((API) => API.InspectContainer({ containerIdOrName })),
        GetContainerLogHistory         : (containerIdOrName) => ContainerRuntimeCommand((API) => API.GetContainerLogHistory({ containerIdOrName })),
        InspectNetwork                 : (networkIdOrName) => SanitizedContainerRuntimeCommand((API) => API.InspectNetwork({ networkIdOrName })),
        CreateNewNetwork               : AuditedMutation("network:create", "network",
                                            (options) => options?.Name ?? null,
                                            (options) => ContainerRuntimeCommand((API) => API.CreateNewNetwork({ options }))),
        RemoveNetwork                  : AuditedMutation("network:remove", "network",
                                            (networkIdOrName) => networkIdOrName,
                                            (networkIdOrName) => ContainerRuntimeCommand((API) => API.RemoveNetwork({ networkIdOrName }))),
        ConnectContainerToNetwork      : AuditedMutation("network:connect", "network-connection",
                                            (options) => `${options?.networkIdOrName ?? "?"}:${options?.containerIdOrName ?? "?"}`,
                                            (options) => ContainerRuntimeCommand((API) => API.ConnectContainerToNetwork({ options }))),
        DisconnectContainerFromNetwork : AuditedMutation("network:disconnect", "network-connection",
                                            (options) => `${options?.networkIdOrName ?? "?"}:${options?.containerIdOrName ?? "?"}`,
                                            (options) => ContainerRuntimeCommand((API) => API.DisconnectContainerFromNetwork({ options }))),
        InspectVolume                  : (volumeName) => SanitizedContainerRuntimeCommand((API) => API.InspectVolume({ volumeName })),
        CreateNewVolume                : AuditedMutation("volume:create", "volume",
                                            (options) => options?.Name ?? null,
                                            (options) => SanitizedContainerRuntimeCommand((API) => API.CreateNewVolume({ options }))),
        RemoveVolume                   : AuditedMutation("volume:remove", "volume",
                                            (volumeName) => volumeName,
                                            (volumeName) => ContainerRuntimeCommand((API) => API.RemoveVolume({ volumeName }))),
        InspectImage                   : (imageIdOrName) => SanitizedContainerRuntimeCommand((API) => API.InspectImage({ imageIdOrName })),
        RemoveImage                    : AuditedMutation("image:remove", "image",
                                            (options) => options?.imageIdOrName ?? null,
                                            (options) => ContainerRuntimeCommand((API) => API.RemoveImage({ options }))),
        // Export só depois do gate: sem usuário → 401; sem permissão ou sem
        // como avaliar → 403. Em nenhum dos dois casos o base64 é produzido.
        ExportImage                    : AuthorizedExport("image", ({ imageIdOrName }) => imageIdOrName,
                                            (imageIdOrName) => ContainerRuntimeCommand((API) => API.ExportImage({ imageIdOrName }))),
        ExportContainer                : AuthorizedExport("container", ({ containerIdOrName }) => containerIdOrName,
                                            (containerIdOrName) => ContainerRuntimeCommand((API) => API.ExportContainer({ containerIdOrName }))),
        ExportVolume                   : AuthorizedExport("volume", ({ volumeName }) => volumeName,
                                            (volumeName) => ContainerRuntimeCommand((API) => API.ExportVolume({ volumeName }))),
        GetExportGuardState            : () => ExportGuard.GetGuardState()
    }

    return Object.freeze(controllerServiceObject)

}

module.exports = ContainerOrchestratorController
module.exports.ContainerRuntimeUnavailableError = ContainerRuntimeUnavailableError
module.exports.TranslateRuntimeUnavailability = TranslateRuntimeUnavailability
