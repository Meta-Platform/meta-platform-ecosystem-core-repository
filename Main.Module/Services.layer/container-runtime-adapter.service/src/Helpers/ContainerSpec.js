/*
    ContainerSpec v1 — o contrato de criação de container (CTMG-54).

    Até aqui `CreateNewContainer` cobria 8 de cerca de 60 campos. Não havia
    restart policy, healthcheck, limite de CPU ou memória, labels,
    capabilities, devices, comando, usuário nem DNS. Quem precisava de
    qualquer um deles voltava para a linha de comando — que é o que este app
    existe para substituir.

    ESTE ARQUIVO É PURO. Nenhuma chamada ao runtime, nenhum efeito. É o que
    permite verificar a tradução dos ~60 campos sem Docker instalado, e é a
    razão de ele ser o primeiro item do épico: todo o resto (recriar, clonar,
    editar, gerar docker run, gerar compose, catálogo de receitas) depende de
    ter UMA representação de container em vez de seis.

    ## Validação que devolve, não lança

    `ValidateContainerSpec` devolve `{ valid, errors: [{ field, code, message }] }`.
    Um formulário com oito abas precisa marcar TODOS os campos errados de uma
    vez; lançar na primeira falha faria o usuário descobrir os problemas um por
    um, a cada tentativa de submeter.

    As funções de conversão, essas sim, lançam — porque quando chegam já
    passaram pela validação.
*/

const { ParseByteSize, CpusToNanoCpus } = require("./ParseByteSize")
const { NormalizeMounts, NormalizePorts, ResolveGroupAdd } = require("./NormalizeContainerCreateInput")
const NormalizeContainerEnvironment = require("./NormalizeContainerEnvironment")

const POLITICAS_DE_REINICIO = ["no", "always", "unless-stopped", "on-failure"]

const SEGUNDOS_EM_NANOSSEGUNDOS = 1e9

/* ------------------------------------------------------------ validação */

const Erro = (field, code, message) => ({ field, code, message })

const ValidateContainerSpec = (spec = {}) => {
    const errors = []

    if (typeof spec.image !== "string" || spec.image.trim() === "") {
        errors.push(Erro("image", "REQUIRED", "Informe a imagem do container."))
    }

    if (spec.name !== undefined && spec.name !== null && spec.name !== "") {
        /*
            A regra de nome é do daemon, e o erro que ele devolve quando o nome
            é inválido não diz qual caractere ofendeu. Conferir aqui deixa a
            mensagem no campo certo do formulário.
        */
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(String(spec.name))) {
            errors.push(Erro(
                "name",
                "INVALID_FORMAT",
                "O nome pode ter letras, números, ponto, hífen e sublinhado, e precisa começar por letra ou número."
            ))
        }
    }

    if (spec.restart?.policy !== undefined && !POLITICAS_DE_REINICIO.includes(spec.restart.policy)) {
        errors.push(Erro(
            "restart.policy",
            "INVALID_VALUE",
            `Política de reinício desconhecida: ${spec.restart.policy}. Use uma de: ${POLITICAS_DE_REINICIO.join(", ")}.`
        ))
    }

    /*
        `maximumRetryCount` só tem efeito com `on-failure`. Com qualquer outra
        política o daemon RECUSA a criação — e o texto dele fala de
        "MaximumRetryCount", campo que ninguém preencheu com esse nome.
    */
    if (spec.restart?.maximumRetryCount > 0 && spec.restart?.policy !== "on-failure") {
        errors.push(Erro(
            "restart.maximumRetryCount",
            "NOT_APPLICABLE",
            "O número máximo de tentativas só vale com a política on-failure."
        ))
    }

    const healthcheck = spec.healthcheck
    if (healthcheck && !healthcheck.disable) {
        const semTeste = healthcheck.test === undefined
            || healthcheck.test === null
            || healthcheck.test === ""
            || (Array.isArray(healthcheck.test) && healthcheck.test.length === 0)

        if (semTeste) {
            errors.push(Erro(
                "healthcheck.test",
                "REQUIRED",
                "Informe o comando de verificação de saúde, ou desative o healthcheck."
            ))
        }

        for (const campo of ["intervalSeconds", "timeoutSeconds", "startPeriodSeconds"]) {
            const valor = healthcheck[campo]
            if (valor !== undefined && (!Number.isFinite(Number(valor)) || Number(valor) < 0)) {
                errors.push(Erro(`healthcheck.${campo}`, "INVALID_VALUE", "Informe um número de segundos."))
            }
        }
    }

    for (const [campo, valor] of [
        ["resources.memoryBytes", spec.resources?.memoryBytes],
        ["resources.memoryReservationBytes", spec.resources?.memoryReservationBytes],
        ["resources.memorySwapBytes", spec.resources?.memorySwapBytes]
    ]) {
        if (valor === undefined || valor === null || valor === "") continue
        if (Number(valor) === -1) continue
        try {
            ParseByteSize(valor, campo)
        } catch (erro) {
            errors.push(Erro(campo, "INVALID_VALUE", erro.message))
        }
    }

    if (spec.resources?.cpus !== undefined && spec.resources.cpus !== "") {
        try {
            CpusToNanoCpus(spec.resources.cpus, "resources.cpus")
        } catch (erro) {
            errors.push(Erro("resources.cpus", "INVALID_VALUE", erro.message))
        }
    }

    /*
        Memória de reserva maior que o limite é aceita pelo daemon e não faz
        sentido nenhum: a reserva é o piso, o limite é o teto.
    */
    try {
        const limite = ParseByteSize(spec.resources?.memoryBytes)
        const reserva = ParseByteSize(spec.resources?.memoryReservationBytes)
        if (limite && reserva && reserva > limite) {
            errors.push(Erro(
                "resources.memoryReservationBytes",
                "INVALID_VALUE",
                "A reserva de memória não pode ser maior que o limite."
            ))
        }
    } catch (erro) {
        // já reportado acima
    }

    // Montagens e portas têm validação própria, que lança nomeando o campo.
    for (const [lista, Normalizar] of [[spec.mounts, NormalizeMounts], [spec.ports, NormalizePorts]]) {
        if (lista === undefined) continue
        try {
            Normalizar(lista)
        } catch (erro) {
            errors.push(Erro(erro.field || "spec", erro.code || "INVALID_VALUE", erro.message))
        }
    }

    return { valid: errors.length === 0, errors }
}

/* ---------------------------------------------------------- conversões */

/*
    O healthcheck da API mede em NANOSSEGUNDOS e o formulário pergunta em
    segundos. Mandar 30 onde se espera 30000000000 produz um healthcheck que
    roda a cada 30 nanossegundos — na prática, um laço infinito de verificação
    que o operador percebe como container instável.
*/
const BuildHealthcheck = (healthcheck) => {
    if (!healthcheck) return undefined

    if (healthcheck.disable) return { Test: ["NONE"] }

    const teste = Array.isArray(healthcheck.test)
        ? healthcheck.test
        : ["CMD-SHELL", String(healthcheck.test)]

    const EmNanos = (segundos) => segundos === undefined || segundos === null || segundos === ""
        ? undefined
        : Math.round(Number(segundos) * SEGUNDOS_EM_NANOSSEGUNDOS)

    const intervalo = EmNanos(healthcheck.intervalSeconds)
    const limite = EmNanos(healthcheck.timeoutSeconds)
    const periodoInicial = EmNanos(healthcheck.startPeriodSeconds)

    return {
        Test: teste,
        ...(intervalo !== undefined ? { Interval: intervalo } : {}),
        ...(limite !== undefined ? { Timeout: limite } : {}),
        ...(periodoInicial !== undefined ? { StartPeriod: periodoInicial } : {}),
        ...(healthcheck.retries !== undefined ? { Retries: Number(healthcheck.retries) } : {})
    }
}

const BuildRestartPolicy = (restart) => {
    if (!restart || !restart.policy) return undefined
    return {
        Name: restart.policy,
        ...(restart.policy === "on-failure" && restart.maximumRetryCount
            ? { MaximumRetryCount: Number(restart.maximumRetryCount) }
            : {})
    }
}

const BuildResources = (resources = {}) => {
    const ComValor = (chave, valor) =>
        valor === undefined || valor === null || valor === "" ? {} : { [chave]: valor }

    const Bytes = (valor) => Number(valor) === -1 ? -1 : ParseByteSize(valor)

    return {
        ...ComValor("Memory", Bytes(resources.memoryBytes)),
        ...ComValor("MemoryReservation", Bytes(resources.memoryReservationBytes)),
        ...ComValor("MemorySwap", Bytes(resources.memorySwapBytes)),
        ...ComValor("NanoCpus", resources.nanoCpus !== undefined
            ? Number(resources.nanoCpus)
            : CpusToNanoCpus(resources.cpus)),
        ...ComValor("CpuShares", resources.cpuShares !== undefined ? Number(resources.cpuShares) : undefined),
        ...ComValor("CpusetCpus", resources.cpusetCpus),
        ...ComValor("PidsLimit", resources.pidsLimit !== undefined ? Number(resources.pidsLimit) : undefined),
        ...ComValor("BlkioWeight", resources.blkioWeight !== undefined ? Number(resources.blkioWeight) : undefined),
        ...(Array.isArray(resources.ulimits) && resources.ulimits.length > 0
            ? {
                Ulimits: resources.ulimits.map((u) => ({
                    Name: u.name,
                    Soft: Number(u.soft),
                    Hard: Number(u.hard ?? u.soft)
                }))
            }
            : {}),
        ...(Array.isArray(resources.deviceRequests) && resources.deviceRequests.length > 0
            ? {
                DeviceRequests: resources.deviceRequests.map((d) => ({
                    Driver: d.driver || "",
                    Count: d.count ?? -1,
                    DeviceIDs: d.deviceIds || [],
                    Capabilities: d.capabilities || [["gpu"]]
                }))
            }
            : {})
    }
}

const NormalizeStringList = (valor) => {
    if (valor === undefined || valor === null) return undefined
    const lista = Array.isArray(valor) ? valor : [valor]
    const limpa = lista.filter((item) => item !== undefined && item !== null && item !== "").map(String)
    return limpa.length > 0 ? limpa : undefined
}

const NormalizarMapaDeTexto = (mapa) =>
    mapa === undefined || mapa === null
        ? undefined
        : Object.fromEntries(
            Object.entries(mapa).map(([chave, valor]) => [chave, valor == null ? "" : String(valor)])
        )

module.exports = {
    ValidateContainerSpec,
    BuildHealthcheck,
    BuildRestartPolicy,
    BuildResources,
    NormalizeStringList,
    NormalizarMapaDeTexto,
    POLITICAS_DE_REINICIO,
    SEGUNDOS_EM_NANOSSEGUNDOS
}
