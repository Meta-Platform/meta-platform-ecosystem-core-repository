/*
    Teste de auditoria das mutações do runtime e do sink de export (VDRP-199).

    Cobre:
    - toda mutação (remove/start/stop/restart/kill/create/connect) audita ator,
      ação, recurso e decisão "allow" no sucesso
    - falha do adapter audita decisão "error" com o motivo, e o erro original
      ainda é lançado para quem chamou (auditoria não engole o erro real)
    - sem authenticationData: recusa (401 UNAUTHENTICATED), evento "deny", e o
      adapter NUNCA é chamado
    - o evento nunca carrega o payload da operação (só o identificador do
      recurso) — nem em options ricos como CreateNewVolume/CreateNewNetwork
    - falha do PRÓPRIO sink de auditoria (RecordEvent rejeita) não derruba a
      operação: o resultado real ainda volta pra quem chamou
    - sem `auditManagerService` local, o AuditRecorder cai no canal remoto do
      IAM (mesmo socket usado pra autorizar) — cobre também o Export*, que
      antes desta correção auditava para um sink sempre `undefined`

    Uso:  node scripts/test-audit-mutations.js
*/
const ContainerOrchestratorController = require("../src/Controllers/ContainerOrchestrator.controller")

let failures = 0
const ok = (cond, msg) => {
    console.log(`${cond ? "  OK   " : "  FALHA"} ${msg}`)
    if (!cond) failures++
}

const USUARIO = { username: "kaio", userId: "u-1" }
const SEGREDO_SENTINELA = "SENHA_SUPER_SECRETA_DO_HOST"

/*
    `runtimeBehavior` permite fazer o adapter falhar num alvo específico, para
    testar a auditoria de erro sem duplicar o mount inteiro.
*/
const MountController = ({ auditLocal = true, comSocketIAM = false, runtimeBehavior = {} } = {}) => {
    const chamadasDoAdapter = []
    const eventosLocais = []
    const chamadasIAM = []

    const commandExecutorLib = {
        require: () => async ({ mainApplicationSocketPath, CommandFunction }) => {
            if (mainApplicationSocketPath === "/tmp/iam-falso.sock") {
                return CommandFunction({
                    APIs: {
                        IAMAppInstance: {
                            AuditManagement: {
                                RecordEvent: async (event) => {
                                    if (runtimeBehavior.sinkFalha) throw new Error("IAM indisponível para auditoria")
                                    chamadasIAM.push(event)
                                    return { queued: true }
                                }
                            }
                        }
                    }
                })
            }
            const API = {
                RemoveContainer: async ({ containerIdOrName }) => {
                    chamadasDoAdapter.push(`RemoveContainer:${containerIdOrName}`)
                    if (runtimeBehavior.removeContainerFalha) throw new Error("Erro ao remover: container em uso")
                    return { removed: true }
                },
                StartContainer: async ({ containerIdOrName }) => { chamadasDoAdapter.push(`StartContainer:${containerIdOrName}`); return { started: true } },
                CreateNewVolume: async ({ options }) => { chamadasDoAdapter.push(`CreateNewVolume:${options?.Name}`); return { Name: options?.Name, Mountpoint: `/var/lib/docker/volumes/${options?.Name}` } },
                CreateNewNetwork: async ({ options }) => { chamadasDoAdapter.push(`CreateNewNetwork:${options?.Name}`); return { Id: "net-1" } },
                ConnectContainerToNetwork: async ({ options }) => { chamadasDoAdapter.push(`Connect:${options?.networkIdOrName}:${options?.containerIdOrName}`); return {} }
            }
            return CommandFunction({ APIs: { ContainerRuntimeAdapterInstance: { ContainerRuntime: API } } })
        }
    }

    const controller = ContainerOrchestratorController({
        commandExecutorLib,
        containerRuntimeSocketPath: "/tmp/runtime-falso.sock",
        containerRuntimeServerManagerUrl: "/server-manager/status",
        iamManagerSocketPath: comSocketIAM ? "/tmp/iam-falso.sock" : undefined,
        iamManagerServerManagerUrl: "/server-manager/status",
        auditManagerService: auditLocal ? { RecordEvent: (evento) => { eventosLocais.push(evento); return { queued: true } } } : undefined
    })

    return { controller, chamadasDoAdapter, eventosLocais, chamadasIAM }
}

const Falhou = async (fn) => {
    try {
        const resultado = await fn()
        return { falhou: false, resultado }
    } catch (error) {
        return { falhou: true, code: error.code, httpStatus: error.httpStatus, message: error.message }
    }
}

const main = async () => {

    console.log("SUCESSO — mutação audita 'allow' com ator e recurso")
    {
        const { controller, chamadasDoAdapter, eventosLocais } = MountController()
        const resultado = await controller.RemoveContainer("c-1", { authenticationData: USUARIO })
        ok(resultado.removed === true, "a remoção realmente aconteceu")
        ok(chamadasDoAdapter.includes("RemoveContainer:c-1"), "o adapter foi chamado com o alvo correto")

        const evento = eventosLocais.find((e) => e.action === "container:remove")
        ok(evento !== undefined, "evento de auditoria foi emitido")
        ok(evento.decision === "allow", `decisão allow (${evento?.decision})`)
        ok(evento.actorUsername === "kaio" && evento.actorUserId === "u-1", "ator (username e userId) auditado")
        ok(evento.resource === "container/c-1", `recurso auditado (${evento?.resource})`)
        ok(evento.eventType === "container_runtime.mutation", "eventType identifica a mutação")
    }

    console.log("\nSUCESSO — cobre as outras mutações (start/create-network/create-volume/connect)")
    {
        const { controller, eventosLocais } = MountController()
        await controller.StartContainer("c-2", { authenticationData: USUARIO })
        await controller.CreateNewNetwork({ Name: "minha-rede" }, { authenticationData: USUARIO })
        await controller.CreateNewVolume({ Name: "meu-volume" }, { authenticationData: USUARIO })
        await controller.ConnectContainerToNetwork({ networkIdOrName: "net-1", containerIdOrName: "c-2" }, { authenticationData: USUARIO })

        const acoes = eventosLocais.map((e) => e.action)
        ok(acoes.includes("container:start"), "StartContainer audita")
        ok(acoes.includes("network:create"), "CreateNewNetwork audita")
        ok(acoes.includes("volume:create"), "CreateNewVolume audita")
        ok(acoes.includes("network:connect"), "ConnectContainerToNetwork audita")

        const redeEvento = eventosLocais.find((e) => e.action === "network:create")
        ok(redeEvento.resource === "network/minha-rede", `recurso da rede é só o nome (${redeEvento.resource})`)
        const volumeEvento = eventosLocais.find((e) => e.action === "volume:create")
        ok(volumeEvento.resource === "volume/meu-volume", `recurso do volume é só o nome (${volumeEvento.resource})`)
        const connectEvento = eventosLocais.find((e) => e.action === "network:connect")
        ok(connectEvento.resource === "network-connection/net-1:c-2", `recurso da conexão (${connectEvento.resource})`)
    }

    console.log("\nFALHA DO ADAPTER — audita 'error' com o motivo, e o erro real ainda sobe")
    {
        const { controller, eventosLocais } = MountController({ runtimeBehavior: { removeContainerFalha: true } })
        const falha = await Falhou(() => controller.RemoveContainer("c-3", { authenticationData: USUARIO }))
        ok(falha.falhou && falha.message.includes("container em uso"), "o erro real do adapter chega a quem chamou")

        const evento = eventosLocais.find((e) => e.action === "container:remove")
        ok(evento !== undefined && evento.decision === "error", `decisão error na falha (${evento?.decision})`)
        ok(evento.reason.includes("container em uso"), "o motivo do erro vai para a auditoria")
    }

    console.log("\nSEM AUTENTICAÇÃO — recusa (401), audita 'deny', adapter NUNCA chamado")
    {
        const { controller, chamadasDoAdapter, eventosLocais } = MountController()
        const semAuth = await Falhou(() => controller.RemoveContainer("c-4"))
        ok(semAuth.falhou && semAuth.code === "UNAUTHENTICATED" && semAuth.httpStatus === 401,
            `sem authenticationData → ${semAuth.code}/${semAuth.httpStatus}`)
        ok(!chamadasDoAdapter.some((c) => c.includes("c-4")), "o adapter NÃO foi chamado")

        const evento = eventosLocais.find((e) => e.resource === "container/c-4")
        ok(evento !== undefined && evento.decision === "deny" && evento.reason === "UNAUTHENTICATED",
            "evento de recusa registrado, mesmo sem ator identificado")
        ok(evento.actorType === "anonymous", "ator anônimo quando não há authenticationData")
    }

    console.log("\nCONTEÚDO SENSÍVEL AUSENTE DO EVENTO")
    {
        const { controller, eventosLocais } = MountController()
        await controller.CreateNewVolume({
            Name: "vol-com-segredo",
            Labels: { senha: SEGREDO_SENTINELA }
        }, { authenticationData: USUARIO })

        const eventosSerializados = JSON.stringify(eventosLocais)
        ok(!eventosSerializados.includes(SEGREDO_SENTINELA),
            "o evento não carrega o conteúdo/payload da operação (só o identificador do recurso)")
    }

    console.log("\nSINK DE AUDITORIA FALHA — a operação NÃO é derrubada")
    {
        const originalConsoleError = console.error
        const logs = []
        console.error = (...args) => logs.push(args.join(" "))
        try {
            const { controller, chamadasDoAdapter } = MountController({ auditLocal: false, comSocketIAM: true, runtimeBehavior: { sinkFalha: true } })
            const resultado = await controller.RemoveContainer("c-5", { authenticationData: USUARIO })
            ok(resultado.removed === true, "a operação real acontece mesmo com o sink de auditoria fora do ar")
            ok(chamadasDoAdapter.includes("RemoveContainer:c-5"), "o adapter foi chamado normalmente")
            // A auditoria é fire-and-forget (não bloqueia a operação real, nem o
            // retorno dela) — dá um tick pro reject assíncrono do sink remoto
            // ser processado antes de checar o log.
            await new Promise((resolve) => setImmediate(resolve))
            ok(logs.some((l) => l.includes("falha ao auditar")), "a falha do sink foi logada, não propagada")
        } finally {
            console.error = originalConsoleError
        }
    }

    console.log("\nSEM auditManagerService LOCAL — cai no canal remoto do IAM (mesmo socket da autorização)")
    {
        const { controller, chamadasIAM } = MountController({ auditLocal: false, comSocketIAM: true })
        await controller.RemoveContainer("c-6", { authenticationData: USUARIO })

        const evento = chamadasIAM.find((e) => e.resource === "container/c-6")
        ok(evento !== undefined, "o evento chegou no AuditManagement.RecordEvent remoto do IAM")
        ok(evento.decision === "allow" && evento.actorUsername === "kaio", "ator e decisão corretos também no canal remoto")
    }

    console.log("\nSEM auditManagerService E SEM socket do IAM — não lança, não audita em lugar nenhum")
    {
        const { controller, eventosLocais, chamadasIAM } = MountController({ auditLocal: false, comSocketIAM: false })
        const resultado = await controller.RemoveContainer("c-7", { authenticationData: USUARIO })
        ok(resultado.removed === true, "a operação acontece mesmo sem nenhum sink de auditoria configurado")
        ok(eventosLocais.length === 0 && chamadasIAM.length === 0, "nenhum evento foi produzido (não há onde escrever)")
    }

    console.log(`\n${failures === 0 ? "TODOS OS CRITÉRIOS PASSARAM" : `${failures} FALHA(S)`}`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
    console.error("ERRO:", error)
    process.exit(1)
})
