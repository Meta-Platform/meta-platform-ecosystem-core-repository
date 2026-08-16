/*
    Pausar, retomar e renomear (CTMG-37).

    Operações finas, e é justamente por serem finas que erram calado: chamar o
    método errado do cliente, ou mandar o nome novo na chave errada, produz um
    "sucesso" que não fez nada.
*/
const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")

const CriarAdaptador = () => {
    const chamadas: any[] = []

    const adaptador = ContainerManager({
        socketPath: "/tmp/irrelevante.sock",
        CreateClient: () => ({
            getEvents: () => {},
            getContainer: (nome: string) => ({
                pause: async () => chamadas.push(["pause", nome]),
                unpause: async () => chamadas.push(["unpause", nome]),
                rename: async (opcoes: any) => chamadas.push(["rename", nome, opcoes])
            })
        })
    })

    return { adaptador, chamadas }
}

test("pausar chama pause no container certo", async () => {
    const { adaptador, chamadas } = CriarAdaptador()

    const resposta = await adaptador.PauseContainer("meu-postgres")

    assert.deepEqual(chamadas, [["pause", "meu-postgres"]])
    assert.equal(resposta.success, true)
    assert.match(resposta.message, /meu-postgres/)
})

test("retomar chama unpause, e não start", async () => {
    // Retomar um container pausado com `start` não faz nada: o cgroup freezer
    // continua congelado e o container segue parado, sem erro nenhum.
    const { adaptador, chamadas } = CriarAdaptador()

    await adaptador.UnpauseContainer("meu-postgres")

    assert.deepEqual(chamadas, [["unpause", "meu-postgres"]])
})

test("renomear manda o nome na chave que a API espera", async () => {
    const { adaptador, chamadas } = CriarAdaptador()

    const resposta = await adaptador.RenameContainer({
        containerIdOrName: "antigo",
        name: "novo"
    })

    assert.deepEqual(chamadas, [["rename", "antigo", { name: "novo" }]])
    assert.equal(resposta.success, true)
    assert.match(resposta.message, /antigo.*novo/)
})

test("espaço em volta do nome novo é aparado", async () => {
    const { adaptador, chamadas } = CriarAdaptador()

    await adaptador.RenameContainer({ containerIdOrName: "c", name: "  espacado  " })

    assert.deepEqual(chamadas[0][2], { name: "espacado" })
})

test("nome novo ausente ou vazio é recusado como erro de entrada", async () => {
    const { adaptador, chamadas } = CriarAdaptador()

    for (const name of [undefined, "", "   ", 42]) {
        await assert.rejects(
            () => adaptador.RenameContainer({ containerIdOrName: "c", name }),
            (erro: any) => erro.code === "INVALID_CONTAINER_NAME" && erro.statusCode === 400
        )
    }

    // Nenhuma chamada chegou ao runtime: a recusa acontece antes.
    assert.deepEqual(chamadas, [])
})
