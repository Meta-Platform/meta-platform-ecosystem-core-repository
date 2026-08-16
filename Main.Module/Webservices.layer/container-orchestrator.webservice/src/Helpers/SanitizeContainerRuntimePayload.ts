/*
    Sanitização das respostas do container runtime (VDRP-194).

    O BFF era passthrough 1:1 do adapter, então o inspect do Docker chegava cru
    ao browser: `Config.Env` com senha e token embutidos, caminhos absolutos do
    host (LogPath, ResolvConfPath, HostnamePath, HostsPath), o `Source` real de
    cada bind-mount, o `Mountpoint` de cada volume e o PID do processo no host.

    A redação é AQUI, no backend, não na UI: uma tela que só deixa de imprimir
    o campo continua entregando o segredo pela rede, e qualquer outro cliente
    (curl, outro painel) recebe tudo.

    Duas regras compõem a proteção:

    1) VALOR DE SEGREDO POR PADRÃO — toda variável de ambiente, label ou opção
       cujo NOME casa com o padrão de segredo tem o valor substituído por
       "***REDACTED***". O nome é preservado, porque o operador precisa saber
       que a variável existe; só o valor sai de cena. O padrão é deliberadamente
       largo (inclui "key"): mascarar um valor inofensivo é barato, vazar um
       segredo não é.

    2) CAMINHO DE HOST NUNCA SAI — os campos de caminho do host são removidos e
       trocados por `<campo>Redacted: true`, para a tela poder dizer "existe,
       mas não é exibido". O caminho DENTRO do container (`Destination`) é
       mantido: é o layout da própria aplicação, não do host.

    Fora de escopo aqui: revelar o valor real sob permissão explícita — depende
    do PEP ligado ao BFF (VDRP-200) e da auditoria com ator (VDRP-199).
*/

const REDACTED = "***REDACTED***"

// password, secret, token, key, credential, authorization (pedidos no item) +
// variantes que aparecem no ecossistema.
const SECRET_NAME_PATTERN = /pass(word|wd)?|senha|secret|token|key|credential|auth(orization)?|bearer|session|cookie|salt|signature|\bpat\b/i

// Caminhos do host devolvidos pelo inspect. `Source` é tratado no contexto de
// Mounts; os demais são chaves de topo do inspect ou do GraphDriver.
const HOST_PATH_KEYS = Object.freeze([
    "LogPath",
    "ResolvConfPath",
    "HostnamePath",
    "HostsPath",
    "Mountpoint",
    "UpperDir",
    "LowerDir",
    "MergedDir",
    "WorkDir"
])

// Internos de runtime que não têm uso no painel e identificam o host.
const DROPPED_KEYS = Object.freeze(["Pid"])

const IsPlainObject = (value: any) =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const MaskEnvEntry = (entry: any) => {
    if (typeof entry !== "string") return entry
    const separator = entry.indexOf("=")
    if (separator === -1) {
        // Sem "=" não há valor a esconder; o nome sozinho não é segredo.
        return entry
    }
    const name = entry.slice(0, separator)
    const value = entry.slice(separator + 1)
    if (value === "") return entry
    return SECRET_NAME_PATTERN.test(name) ? `${name}=${REDACTED}` : entry
}

const MaskEnvList = (envList: any) =>
    Array.isArray(envList) ? envList.map(MaskEnvEntry) : envList

// Labels e Options são mapa nome→valor e já foram usados para carregar
// credencial de driver de volume.
const MaskNamedValues = (map: any) => {
    if (!IsPlainObject(map)) return map
    const masked: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(map)) {
        masked[name] = SECRET_NAME_PATTERN.test(name) && value !== null && value !== undefined && value !== ""
            ? REDACTED
            : value
    }
    return masked
}

const SanitizeMount = (mount: any) => {
    if (!IsPlainObject(mount)) return mount
    const { Source, ...rest } = mount
    const sanitized = Sanitize(rest)
    if (Source !== undefined) {
        // O lado do host do bind-mount não sai; o nome do volume (quando existe)
        // já identifica o recurso para o operador.
        sanitized.SourceRedacted = true
    }
    return sanitized
}

/*
    Caminhada recursiva. Trata cada família pelo NOME da chave, o que cobre as
    duas formas do inspect (container tem Config.Env, imagem tem Config.Env e
    ContainerConfig.Env) sem precisar de um sanitizador por shape.
*/
const Sanitize = (node: any): any => {
    if (Array.isArray(node)) return node.map(Sanitize)
    if (!IsPlainObject(node)) return node

    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
        if (DROPPED_KEYS.includes(key)) {
            continue
        }
        if (HOST_PATH_KEYS.includes(key)) {
            if (value !== null && value !== undefined && value !== "") {
                output[`${key}Redacted`] = true
            }
            continue
        }
        if (key === "Env") {
            output[key] = MaskEnvList(value)
            continue
        }
        if (key === "Labels" || key === "Options") {
            output[key] = MaskNamedValues(value)
            continue
        }
        if (key === "Mounts" && Array.isArray(value)) {
            output[key] = value.map(SanitizeMount)
            continue
        }
        output[key] = Sanitize(value)
    }
    return output
}

const SanitizeContainerRuntimePayload = (payload: any) => Sanitize(payload)

module.exports = SanitizeContainerRuntimePayload
module.exports.REDACTED = REDACTED
module.exports.SECRET_NAME_PATTERN = SECRET_NAME_PATTERN
module.exports.HOST_PATH_KEYS = HOST_PATH_KEYS
module.exports.DROPPED_KEYS = DROPPED_KEYS
