/*
    Filtros de poda, no formato que a API espera (CTMG-40, 47, 49, 51).

    O Docker recebe filtros como um mapa de LISTAS: `{"label":["a=b"],
    "until":["24h"]}`. Escrever `{ label: "a=b" }` — a forma natural para quem
    chama — não dá erro: o daemon simplesmente ignora o filtro e apaga MAIS do
    que foi pedido. Numa operação destrutiva, um filtro silenciosamente ignorado
    é a pior falha possível.

    Por isso a normalização é aqui, uma vez, e as quatro podas (containers,
    imagens, redes, volumes) usam a mesma.

    Não serializa para JSON de propósito: o docker-modem já transforma objeto em
    JSON ao montar a query string, e serializar dos dois lados produziria uma
    string escapada duas vezes que o daemon rejeita.

    Função pura, verificável sem runtime.
*/

const NormalizePruneFilters = (filters) => {
    if (filters === undefined || filters === null) return undefined

    // Já veio pronto como JSON: quem montou sabia o que estava fazendo.
    if (typeof filters === "string") {
        return filters.trim() === "" ? undefined : filters
    }

    if (typeof filters !== "object" || Array.isArray(filters)) {
        const erro = new Error("filters precisa ser um objeto de listas, ex.: { label: [\"app=meu\"] }.")
        erro.code = "INVALID_PRUNE_FILTERS"
        erro.httpStatus = 400
        erro.statusCode = 400
        throw erro
    }

    const normalizados = {}

    for (const [chave, valor] of Object.entries(filters)) {
        if (valor === undefined || valor === null) continue

        const lista = (Array.isArray(valor) ? valor : [valor])
            .filter((item) => item !== undefined && item !== null && item !== "")
            .map((item) => typeof item === "boolean" ? String(item) : String(item))

        if (lista.length > 0) normalizados[chave] = lista
    }

    return Object.keys(normalizados).length > 0 ? normalizados : undefined
}

const BuildPruneOptions = (filters) => {
    const normalizados = NormalizePruneFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

module.exports = BuildPruneOptions
module.exports.NormalizePruneFilters = NormalizePruneFilters
