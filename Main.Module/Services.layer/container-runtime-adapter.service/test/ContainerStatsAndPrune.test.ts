/*
    Foto de métricas, espera e poda (CTMG-40).

    Duas coisas aqui merecem teste de verdade, e nenhuma delas é "a chamada
    acontece":

    1. O snapshot e o stream têm de produzir a MESMA forma. Enquanto eram duas
       cópias da mesma aritmética, nada impedia a lista e o painel de um mesmo
       container mostrarem números diferentes.

    2. Filtro de poda em forma errada não dá erro no Docker: ele é IGNORADO, e
       a poda apaga mais do que foi pedido.
*/
const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")
const NormalizeContainerStats = require("../src/Helpers/NormalizeContainerStats")
const BuildPruneOptions = require("../src/Helpers/BuildPruneOptions")

// Amostra no formato do runtime, com dois pontos de CPU para haver variação.
const AMOSTRA = {
    read: "2026-08-04T14:00:00.000Z",
    cpu_stats: {
        cpu_usage: { total_usage: 2_000_000_000 },
        system_cpu_usage: 20_000_000_000,
        online_cpus: 4
    },
    precpu_stats: {
        cpu_usage: { total_usage: 1_000_000_000 },
        system_cpu_usage: 18_000_000_000
    },
    memory_stats: { usage: 300 * 1024 * 1024, limit: 1024 * 1024 * 1024, stats: { cache: 44 * 1024 * 1024 } },
    networks: { eth0: { rx_bytes: 1000, tx_bytes: 2000 }, eth1: { rx_bytes: 500, tx_bytes: 0 } },
    blkio_stats: {
        io_service_bytes_recursive: [
            { op: "Read", value: 4096 },
            { op: "Write", value: 8192 },
            { op: "Sync", value: 999 }
        ]
    },
    pids_stats: { current: 12 }
}

/* ------------------------------------------------------------ normalização */

test("a aritmética de CPU é a variação entre duas amostras, vezes os núcleos", () => {
    // delta cpu = 1e9, delta sistema = 2e9, 4 núcleos → 0.5 * 4 * 100 = 200%
    assert.equal(NormalizeContainerStats(AMOSTRA).cpuPercent, 200)
})

test("sem amostra anterior, a CPU é 0 em vez de um número inventado", () => {
    /*
        DEFEITO ANTIGO, achado por este teste.

        Com `precpu_stats` vazio a conta subtraía de zero, e o "delta" passava a
        ser tudo desde o boot do container: a média de vida inteira aparecia
        como uso instantâneo. Acontecia na PRIMEIRA amostra de todo stream ao
        vivo — o número que o operador vê ao abrir a tela.

        Aqui daria 40% (2e9/20e9 × 4 núcleos) para um container que pode estar
        ocioso há horas.
    */
    const semAnterior = { ...AMOSTRA, precpu_stats: {} }
    assert.equal(NormalizeContainerStats(semAnterior).cpuPercent, 0)

    // Também quando o runtime manda o campo zerado em vez de omiti-lo.
    const anteriorZerado = {
        ...AMOSTRA,
        precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 }
    }
    assert.equal(NormalizeContainerStats(anteriorZerado).cpuPercent, 0)
})

test("a memória desconta o cache de páginas, como o docker stats faz", () => {
    // 300 MiB de uso menos 44 MiB de cache = 256 MiB
    const normalizada = NormalizeContainerStats(AMOSTRA)
    assert.equal(normalizada.memoryUsage, 256 * 1024 * 1024)
    assert.equal(normalizada.memoryPercent, 25)
})

test("limite de memória zero não vira divisão por zero", () => {
    const semLimite = { ...AMOSTRA, memory_stats: { usage: 100, limit: 0 } }
    assert.equal(NormalizeContainerStats(semLimite).memoryPercent, 0)
})

test("rede soma todas as interfaces; disco separa leitura de escrita", () => {
    const n = NormalizeContainerStats(AMOSTRA)
    assert.equal(n.networkRx, 1500)
    assert.equal(n.networkTx, 2000)
    assert.equal(n.blockRead, 4096)
    assert.equal(n.blockWrite, 8192)
})

test("amostra vazia não quebra nem inventa valores", () => {
    const n = NormalizeContainerStats({})
    assert.deepEqual(n, {
        readAt: undefined,
        cpuPercent: 0,
        memoryUsage: 0,
        memoryLimit: 0,
        memoryPercent: 0,
        networkRx: 0,
        networkTx: 0,
        blockRead: 0,
        blockWrite: 0,
        pids: 0
    })
})

/* ------------------------------------------- foto e stream, a mesma forma */

const CriarAdaptador = ({ statsSnapshot, wait, prune }: any = {}) => {
    const registrado: any = {}

    const adaptador = ContainerManager({
        socketPath: "/tmp/irrelevante.sock",
        CreateClient: () => ({
            getEvents: () => {},
            pruneContainers: async (opcoes: any) => {
                registrado.pruneOptions = opcoes
                return prune ?? { ContainersDeleted: ["a", "b"], SpaceReclaimed: 1234 }
            },
            getContainer: () => ({
                stats: async (opcoes: any) => {
                    registrado.statsOptions = opcoes
                    return statsSnapshot ?? AMOSTRA
                },
                wait: async (opcoes: any) => {
                    registrado.waitOptions = opcoes
                    return wait ?? { StatusCode: 0 }
                }
            })
        })
    })

    return { adaptador, registrado }
}

test("a foto tem exatamente as mesmas chaves que o stream entrega", async () => {
    const { adaptador } = CriarAdaptador()

    const foto = await adaptador.GetContainerStatsSnapshot("c")

    assert.deepEqual(Object.keys(foto).sort(), Object.keys(NormalizeContainerStats(AMOSTRA)).sort())
    assert.deepEqual(foto, NormalizeContainerStats(AMOSTRA))
})

test("a foto pede stream: false — é o que faz o runtime coletar duas amostras", async () => {
    // Com `one-shot` a resposta é imediata e o percentual de CPU sai sempre 0.
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.GetContainerStatsSnapshot("c")

    assert.deepEqual(registrado.statsOptions, { stream: false })
})

test("a foto aceita a amostra como texto cru, conforme a versão do dockerode", async () => {
    const { adaptador } = CriarAdaptador({ statsSnapshot: Buffer.from(JSON.stringify(AMOSTRA)) })

    const foto = await adaptador.GetContainerStatsSnapshot("c")

    assert.equal(foto.cpuPercent, 200)
})

/* ------------------------------------------------------------------ espera */

test("a espera devolve o código de saída e usa not-running por padrão", async () => {
    const { adaptador, registrado } = CriarAdaptador({ wait: { StatusCode: 137 } })

    const resultado = await adaptador.WaitContainer({ containerIdOrName: "c" })

    assert.equal(resultado.StatusCode, 137)
    assert.deepEqual(registrado.waitOptions, { condition: "not-running" })
})

test("a condição da espera pode ser escolhida", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.WaitContainer({ containerIdOrName: "c", condition: "next-exit" })

    assert.deepEqual(registrado.waitOptions, { condition: "next-exit" })
})

/* -------------------------------------------------------------------- poda */

test("poda sem filtro não manda filtro nenhum", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    const resultado = await adaptador.PruneContainers()

    assert.deepEqual(registrado.pruneOptions, {})
    assert.deepEqual(resultado, { ContainersDeleted: ["a", "b"], SpaceReclaimed: 1234 })
})

test("filtro escalar vira LISTA — que é a única forma que o Docker respeita", () => {
    // `{ label: "app=meu" }` não dá erro no daemon: é ignorado, e a poda apaga
    // tudo. Numa operação destrutiva, filtro ignorado é a pior falha possível.
    assert.deepEqual(
        BuildPruneOptions({ label: "app=meu" }),
        { filters: { label: ["app=meu"] } }
    )
})

test("lista continua lista, e valores vazios somem", () => {
    assert.deepEqual(
        BuildPruneOptions({ label: ["a=1", "b=2"], until: "", dangling: undefined }),
        { filters: { label: ["a=1", "b=2"] } }
    )
})

test("filtro só com valores vazios equivale a não filtrar", () => {
    assert.deepEqual(BuildPruneOptions({ label: [] }), {})
    assert.deepEqual(BuildPruneOptions({}), {})
    assert.deepEqual(BuildPruneOptions(), {})
})

test("booleano vira string, como a API exige", () => {
    assert.deepEqual(BuildPruneOptions({ dangling: true }), { filters: { dangling: ["true"] } })
})

test("filtro já em JSON passa intacto — quem montou sabia o que fazia", () => {
    assert.deepEqual(
        BuildPruneOptions('{"until":["24h"]}'),
        { filters: '{"until":["24h"]}' }
    )
})

test("filtro em forma impossível é recusado como erro de entrada", () => {
    // O mesmo código para listagem e poda: a normalização é uma só, porque o
    // erro é o mesmo — só muda o tamanho da consequência.
    for (const invalido of [["label=a"], 42, true]) {
        assert.throws(
            () => BuildPruneOptions(invalido),
            (erro: any) => erro.code === "INVALID_FILTERS" && erro.statusCode === 400
        )
    }
})

test("o filtro chega à chamada de poda", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.PruneContainers({ filters: { label: "app=meu" } })

    assert.deepEqual(registrado.pruneOptions, { filters: { label: ["app=meu"] } })
})
