// Histórico curto de amostras, em memória, por chave (uma chave = uma instância).
//
// Um gráfico de desempenho precisa do passado recente, não do histórico completo:
// quem abre o painel quer ver "o que aconteceu nos últimos minutos". Guardar em
// banco seria caro para um dado que perde valor em segundos — daí um buffer
// circular com teto fixo, que dá ao daemon um custo de memória constante mesmo
// depois de meses no ar.
//
// A janela coberta é `capacity * intervalo de amostragem`: 300 amostras a cada
// 2s ≈ 10 minutos.
const CreateMetricsHistory = ({ capacity = 300 } = {}) => {

    if(!Number.isFinite(capacity) || capacity <= 0)
        throw new Error("CreateMetricsHistory: 'capacity' deve ser um número positivo.")

    const seriesByKey = new Map()

    const Push = (key, sample) => {
        if(key === undefined || key === null) return
        const series = seriesByKey.get(key) || []
        series.push(sample)
        // Descarta o excedente pela frente: o mais antigo é o primeiro a sair.
        if(series.length > capacity) series.splice(0, series.length - capacity)
        seriesByKey.set(key, series)
    }

    // Cópia: quem recebe pode serializar/ordenar sem corromper o buffer.
    // `limit` recorta as amostras MAIS RECENTES (o fim da série).
    const Get = (key, limit) => {
        const series = seriesByKey.get(key) || []
        if(limit === undefined || limit >= series.length) return [...series]
        return series.slice(series.length - limit)
    }

    const GetLast = (key) => {
        const series = seriesByKey.get(key)
        return series && series.length > 0 ? series[series.length - 1] : undefined
    }

    const Keys = () => Array.from(seriesByKey.keys())

    const Forget = (key) => seriesByKey.delete(key)

    // Remove tudo que não está mais na lista viva — é o que impede o histórico
    // de acumular instâncias já encerradas para sempre.
    const KeepOnly = (keyList) => {
        const keep = new Set(keyList || [])
        Array.from(seriesByKey.keys())
            .filter((key) => !keep.has(key))
            .forEach((key) => seriesByKey.delete(key))
    }

    const Clear = () => seriesByKey.clear()

    return Object.freeze({ capacity, Push, Get, GetLast, Keys, Forget, KeepOnly, Clear })
}

module.exports = CreateMetricsHistory
