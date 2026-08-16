/*
    Opções de poda (CTMG-40, 47, 49, 51).

    A normalização dos filtros é a mesma de qualquer listagem — vive em
    NormalizeDockerFilters.js, junto com a explicação de por que um filtro em
    forma errada é pior que um erro. Aqui só se monta o objeto de opções.
*/

import type { DockerFilters, NormalizeDockerFiltersFn } from "../Operations/Types"

const NormalizeDockerFilters = require("./NormalizeDockerFilters") as NormalizeDockerFiltersFn

const BuildPruneOptions = (filters?: DockerFilters) => {
    const normalizados = NormalizeDockerFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

module.exports = BuildPruneOptions
