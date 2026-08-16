/*
    Sink de auditoria compartilhado pelos controllers deste pacote (VDRP-199).

    Mesma descoberta de VDRP-196 (host-actions, ecosystem-administrator.webservice):
    o identity-and-access-core.app já expõe AuditManagement.RecordEvent pelo MESMO
    socket usado para autorizar (iamManagerSocketPath/iamManagerServerManagerUrl).
    Preferência por um `auditManagerService` LOCAL, se algum dia for injetado
    (bound-param opcional, hoje nunca vinculado em nenhum boot.json do
    ecossistema); na falta dele, cai nesse canal remoto. Sem os dois, audita
    para NADA — silenciosamente, o comportamento correto para um painel
    provisionado sem o IAM vinculado (auditoria não pode travar operação).

    ANTES desta troca, `CreateExportAuthorizationGuard` só recebia
    `auditManagerService?.RecordEvent`, que é sempre `undefined` em produção —
    o audit de Export* (VDRP-195/196) nunca escrevia em lugar nenhum. Este
    helper fecha essa lacuna e passa a valer também para as mutações
    (remove/kill/start/stop/create/connect) que este item (VDRP-199)
    adiciona.

    Contrato de conteúdo: SÓ ator, ação, recurso, decisão e motivo. Nunca o
    payload da operação (conteúdo de arquivo, variável de ambiente, segredo).
    Quem monta o `resource` é responsabilidade de quem chama `RecordEvent`.

    Auditoria NUNCA derruba o fluxo auditado: qualquer falha aqui dentro (sink
    ausente, socket fora, exceção síncrona ou promise rejeitada) só loga.
*/

const IAM_SERVER_NAME = "IAMAppInstance"

const IsUsablePath = (value: any) =>
    typeof value === "string" && value.length > 0 && !value.startsWith("{{")

const CreateAuditRecorder = ({
    auditManagerService,
    commandExecutorLib,
    iamManagerSocketPath,
    iamManagerServerManagerUrl,
    logPrefix = "audit"
}: any = {}) => {

    const MountRecordEventFunction = () => {
        if (typeof auditManagerService?.RecordEvent === "function") {
            return auditManagerService.RecordEvent
        }
        if (!commandExecutorLib || !IsUsablePath(iamManagerSocketPath)) return undefined
        const CommandExecutor = commandExecutorLib.require("CommandExecutor")
        return (event: any) => CommandExecutor({
            serverResourceEndpointPath: iamManagerServerManagerUrl,
            mainApplicationSocketPath: iamManagerSocketPath,
            CommandFunction: async ({ APIs }: any) => APIs[IAM_SERVER_NAME].AuditManagement.RecordEvent(event)
        })
    }

    const RecordEventFunction = MountRecordEventFunction()

    // Sink "cru", no formato que CreateExportAuthorizationGuard/
    // CreateHostActionsAuthorizationGuard já esperam receber em `Audit`.
    const RecordEvent = (event: any) => {
        if (typeof RecordEventFunction !== "function") return
        try {
            const result = RecordEventFunction(event)
            if (result && typeof result.catch === "function") {
                result.catch((error: any) => console.error(`[${logPrefix}] falha ao auditar: ${error.message}`))
            }
        } catch(error: any) {
            console.error(`[${logPrefix}] falha ao auditar: ${error.message}`)
        }
    }

    // Conveniência para quem só tem authenticationData + ação/recurso/decisão à
    // mão (as mutações auditadas deste controller) — monta o ator e delega em
    // RecordEvent.
    const RecordDecision = ({ authenticationData, eventType, action, resource, decision, reason, requestId }: any) => {
        RecordEvent({
            eventType,
            actorType: authenticationData ? "user" : "anonymous",
            actorUrn: authenticationData?.username ?? null,
            actorUsername: authenticationData?.username ?? null,
            actorUserId: authenticationData?.userId ?? null,
            action,
            resource,
            decision,
            reason: reason ?? null,
            requestId: requestId ?? null
        })
    }

    return {
        RecordEvent,
        RecordDecision,
        IsConfigured: () => typeof RecordEventFunction === "function"
    }
}

module.exports = CreateAuditRecorder
