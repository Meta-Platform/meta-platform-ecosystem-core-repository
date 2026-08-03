/*
    Gate de autorização do export de filesystem (VDRP-195).

    Os três Export* devolvem o filesystem inteiro de uma imagem, container ou
    volume. É a operação mais perigosa do painel: com ela se baixa /etc/shadow,
    chave privada e dump de banco de qualquer workload. O `needsAuth` fechado em
    VDRP-122 garante que existe UM usuário; não garante que ESTE usuário pode
    exportar. Este gate é a segunda metade.

    Decisão central — FAIL-CLOSED SEM EXCEÇÃO:
    para uma ação crítica, ausência de infraestrutura de autorização significa
    RECUSA, nunca liberação. Se a lib de autorização não foi vinculada, se o
    socket do IAM não foi configurado, se o PDP está inalcançável ou se o PEP
    ainda está em WAITING_FOR_IAM (VDRP-131), o export é negado. Isso é o oposto
    do failMode "open" que vale para leitura: ali indisponibilidade não pode
    parar o painel; aqui ela não pode virar download irrestrito.

    O erro carrega `code` e `httpStatus` para o chamador poder distinguir
    "não identificado" (401) de "identificado e sem permissão" (403).
*/

const EXPORT_PERMISSION = "container:export"

class ExportRefusedError extends Error {
    constructor({ code, httpStatus, message, detail }) {
        super(message)
        this.name = "ExportRefusedError"
        this.code = code
        this.httpStatus = httpStatus
        // O finalhandler do Express só lê `status`/`statusCode`; `httpStatus`
        // sozinho era ignorado e a recusa chegava ao browser como 500.
        this.statusCode = httpStatus
        this.detail = detail ?? null
    }
}

const Unauthenticated = () => new ExportRefusedError({
    code: "UNAUTHENTICATED",
    httpStatus: 401,
    message: "Export exige usuário autenticado."
})

const PermissionDenied = (detail) => new ExportRefusedError({
    code: "PERMISSION_DENIED",
    httpStatus: 403,
    message: `Export exige a permissão ${EXPORT_PERMISSION}.`,
    detail
})

const AuthorizationUnavailable = (detail) => new ExportRefusedError({
    code: "AUTHORIZATION_UNAVAILABLE",
    httpStatus: 403,
    message: "Export negado: não foi possível avaliar a autorização.",
    detail
})

/*
    `CreateAuthorizationClientFunction` é injetada (a lib não conhece
    transporte) e `EvaluateFunction` faz a chamada ao PDP do IAM. Ambas
    opcionais: sem elas o gate nega tudo, que é o comportamento desejado num
    painel provisionado sem o IAM vinculado.
*/
const CreateExportAuthorizationGuard = ({
    CreateAuthorizationClientFunction,
    EvaluateFunction,
    Audit
} = {}) => {

    const client = (typeof CreateAuthorizationClientFunction === "function" && typeof EvaluateFunction === "function")
        ? CreateAuthorizationClientFunction({
            EvaluateFunction,
            // Crítico: nunca liberar por indisponibilidade do PDP.
            failMode: "closed"
        })
        : null

    const RecordDecision = ({ authenticationData, action, resource, decision, reason, requestId }) => {
        if (typeof Audit !== "function") return
        try {
            Audit({
                eventType: "container_export.decision",
                actorType: authenticationData ? "user" : "anonymous",
                actorUrn: authenticationData?.username ?? null,
                actorUsername: authenticationData?.username ?? null,
                actorUserId: authenticationData?.userId ?? null,
                action,
                resource,
                decision,
                reason,
                requestId: requestId ?? null
            })
        } catch (error) {
            // Auditoria nunca derruba o fluxo auditado.
            console.error(`[container-export] falha ao auditar: ${error.message}`)
        }
    }

    /*
        Devolve o resultado da avaliação ou LANÇA. Quem chama só prossegue se
        esta função retornar.
    */
    const AssertCanExport = async ({ authenticationData, resource, reason, requestId }) => {

        if (!authenticationData || (!authenticationData.username && !authenticationData.userId)) {
            RecordDecision({ authenticationData, action: EXPORT_PERMISSION, resource, decision: "deny", reason: "UNAUTHENTICATED", requestId })
            throw Unauthenticated()
        }

        if (client === null) {
            RecordDecision({
                authenticationData, action: EXPORT_PERMISSION, resource,
                decision: "error", reason: "AUTHORIZATION_CLIENT_NOT_CONFIGURED", requestId
            })
            throw AuthorizationUnavailable("cliente de autorização não vinculado ao BFF")
        }

        let decision
        try {
            decision = await client.Authorize({
                principal: {
                    type: "user",
                    username: authenticationData.username,
                    userId: authenticationData.userId
                },
                action: EXPORT_PERMISSION,
                resource
            })
        } catch (error) {
            RecordDecision({ authenticationData, action: EXPORT_PERMISSION, resource, decision: "error", reason: error.message, requestId })
            throw AuthorizationUnavailable(error.message)
        }

        if (decision.decision !== "ALLOW") {
            RecordDecision({
                authenticationData, action: EXPORT_PERMISSION, resource,
                decision: "deny", reason: decision.reason, requestId
            })
            // PDP indisponível (degradado) não é "sem permissão": separa os dois
            // para o operador saber se falta permissão ou falta o IAM.
            throw decision.degraded
                ? AuthorizationUnavailable(decision.reason)
                : PermissionDenied(decision.reason)
        }

        RecordDecision({
            authenticationData, action: EXPORT_PERMISSION, resource,
            decision: "allow", reason: reason ?? null, requestId
        })

        return decision
    }

    const GetGuardState = () => ({
        configured: client !== null,
        permission: EXPORT_PERMISSION,
        failMode: "closed",
        readiness: client === null ? null : client.GetReadinessState()
    })

    return { AssertCanExport, GetGuardState }
}

module.exports = CreateExportAuthorizationGuard
module.exports.ExportRefusedError = ExportRefusedError
module.exports.EXPORT_PERMISSION = EXPORT_PERMISSION
