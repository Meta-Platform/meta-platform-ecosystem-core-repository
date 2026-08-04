/*
    Filtros da API do Docker, no formato que ela realmente aceita.

    O daemon recebe filtros como um mapa de LISTAS de string:
    `{"label":["a=b"],"status":["exited"]}`. Escrever `{ label: "a=b" }` — a
    forma natural para quem chama — NÃO dá erro: o filtro é silenciosamente
    ignorado.

    Nas listagens isso significa mostrar tudo quando se pediu um recorte. Nas
    PODAS significa apagar tudo quando se pediu apagar um pouco. É o mesmo bug
    com dois tamanhos de consequência, e por isso a normalização é uma só,
    usada por listagem e por poda.

    Função pura, verificável sem runtime.
*/

const NormalizeDockerFilters = (filters) => {
    if (filters === undefined || filters === null) return undefined

    // Já veio pronto como JSON: quem montou sabia o que estava fazendo.
    if (typeof filters === "string") {
        return filters.trim() === "" ? undefined : filters
    }

    if (typeof filters !== "object" || Array.isArray(filters)) {
        const erro = new Error(
            "filters precisa ser um objeto de listas, ex.: { status: [\"exited\"] }."
        )
        erro.code = "INVALID_FILTERS"
        erro.httpStatus = 400
        erro.statusCode = 400
        throw erro
    }

    const normalizados = {}

    for (const [chave, valor] of Object.entries(filters)) {
        if (valor === undefined || valor === null) continue

        const lista = (Array.isArray(valor) ? valor : [valor])
            .filter((item) => item !== undefined && item !== null && item !== "")
            .map(String)

        if (lista.length > 0) normalizados[chave] = lista
    }

    return Object.keys(normalizados).length > 0 ? normalizados : undefined
}

module.exports = NormalizeDockerFilters
