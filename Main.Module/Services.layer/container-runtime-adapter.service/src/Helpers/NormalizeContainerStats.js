/*
    A amostra de métricas do runtime, traduzida (CTMG-22, CTMG-40).

    O runtime entrega um JSON grande, com nomes do cgroup e contadores
    ACUMULADOS. Percentual de CPU não vem pronto: é a variação entre duas
    amostras dividida pela variação do tempo de sistema, vezes o número de
    núcleos. Fazer essa conta uma vez, aqui, evita que cada tela invente a sua
    — e elas inventariam diferente.

    Existe em arquivo próprio porque DUAS operações precisam da mesma tradução:
    `StreamContainerStats`, que acompanha, e `GetContainerStatsSnapshot`, que
    tira uma foto. Duplicar a conta seria garantir que a lista e o painel de um
    mesmo container mostrassem números diferentes com o tempo.

    Função pura: dá para verificar a aritmética inteira sem runtime nenhum.
*/

/*
    A memória "usada" que interessa é a que o processo realmente ocupa. O
    contador do cgroup inclui o cache de páginas, que o kernel devolve sob
    pressão — mostrá-lo faria qualquer container que leu um arquivo grande
    parecer estar estourando o limite. É o mesmo desconto que o `docker stats`
    faz.
*/
const MemoriaUsada = (amostra) =>
    (amostra.memory_stats?.usage || 0) - (amostra.memory_stats?.stats?.cache || 0)

const PercentualDeCpu = (amostra) => {
    const cpu = amostra.cpu_stats || {}
    const anterior = amostra.precpu_stats || {}

    /*
        SEM AMOSTRA ANTERIOR NÃO EXISTE TAXA.

        Isto não é zelo: era um número errado sendo mostrado. Quando
        `precpu_stats` vem vazio — primeira amostra de qualquer stream, e toda
        resposta com `one-shot` — subtrair de zero faz o "delta" virar TUDO
        desde o boot do container, e a divisão devolve a média de vida inteira
        apresentada como uso instantâneo. Um container que trabalhou muito na
        subida e está ocioso há horas aparecia com dezenas de por cento.

        O sinal de que houve amostra anterior é o `system_cpu_usage` dela: o
        runtime só o preenche quando tem um ponto de comparação de verdade.
        Sem ele, 0 é a única resposta honesta — e é o que a interface mostra
        até a amostra seguinte chegar, um segundo depois.
    */
    if (!anterior.system_cpu_usage) return 0

    const deltaCpu = (cpu.cpu_usage?.total_usage || 0) - (anterior.cpu_usage?.total_usage || 0)
    const deltaSistema = (cpu.system_cpu_usage || 0) - (anterior.system_cpu_usage || 0)
    const nucleos = cpu.online_cpus || (cpu.cpu_usage?.percpu_usage || []).length || 1

    if (deltaSistema <= 0 || deltaCpu <= 0) return 0

    return (deltaCpu / deltaSistema) * nucleos * 100
}

const TotalDeRede = (amostra) => {
    const redes = amostra.networks || {}
    return Object.keys(redes).reduce((total, nome) => ({
        rx: total.rx + (redes[nome].rx_bytes || 0),
        tx: total.tx + (redes[nome].tx_bytes || 0)
    }), { rx: 0, tx: 0 })
}

const TotalDeBloco = (amostra) =>
    (amostra.blkio_stats?.io_service_bytes_recursive || [])
        .reduce((total, entrada) => {
            const operacao = String(entrada.op || "").toLowerCase()
            if (operacao === "read") total.read += entrada.value || 0
            if (operacao === "write") total.write += entrada.value || 0
            return total
        }, { read: 0, write: 0 })

const NormalizeContainerStats = (amostra) => {
    const memoriaUsada = MemoriaUsada(amostra)
    const memoriaLimite = amostra.memory_stats?.limit || 0
    const rede = TotalDeRede(amostra)
    const blocos = TotalDeBloco(amostra)

    return {
        readAt: amostra.read,
        cpuPercent: Number(PercentualDeCpu(amostra).toFixed(2)),
        memoryUsage: memoriaUsada,
        memoryLimit: memoriaLimite,
        memoryPercent: memoriaLimite > 0
            ? Number(((memoriaUsada / memoriaLimite) * 100).toFixed(2))
            : 0,
        networkRx: rede.rx,
        networkTx: rede.tx,
        blockRead: blocos.read,
        blockWrite: blocos.write,
        pids: amostra.pids_stats?.current || 0
    }
}

module.exports = NormalizeContainerStats
module.exports.PercentualDeCpu = PercentualDeCpu
