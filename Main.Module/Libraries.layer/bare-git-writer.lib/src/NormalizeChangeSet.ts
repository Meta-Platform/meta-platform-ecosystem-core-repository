import type { ChangeLimits, ChangeScope, NormalizedChange, RawChange } from "./Types"

const { InvalidChangeError } = require("./Errors") as { InvalidChangeError: new (message: string, code?: string) => Error }

/*
    Validação e normalização do change set — pura, sem git, sem disco.

    Está separada do escritor de propósito: é a única parte que decide se um
    pedido é aceitável, é a que mais precisa de teste, e roda ANTES de qualquer
    `hash-object`. Change set inválido não pode deixar objeto solto no
    repositório, e a única forma de garantir isso é não começar.
*/

const DEFAULT_LIMITS: ChangeLimits = {
    maxChanges     : 512,
    maxFileBytes   : 4 * 1024 * 1024,
    maxTotalBytes  : 32 * 1024 * 1024,
    maxPathBytes   : 4096,
    maxMessageBytes: 64 * 1024
}

// Só arquivo comum e executável. Ver AssertMode para o que fica de fora e por quê.
const ALLOWED_MODES = new Set(["100644", "100755"])

const OPERATIONS = new Set(["put", "delete", "move"])

/*
    O teto de conteúdo é o MESMO da leitura (BINARY_FILE_MAX_BYTES do lado que
    consome). Não é coincidência: se desse para escrever mais do que se lê, o
    arquivo voltaria truncado na próxima abertura e o salvamento seguinte
    apagaria o resto — perda de dado que a tela não teria como perceber.
*/

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

const DecodeBase64 = (value: string, path: string): Buffer => {
    const compact = value.replace(/\s+/g, "")
    /*
        `Buffer.from(x, "base64")` IGNORA caractere inválido em silêncio: um
        payload corrompido no meio do caminho não falha, vira outro arquivo. Como
        o que está sendo gravado é o código de alguém, a validação estrita vale
        as três linhas.
    */
    if (compact.length % 4 !== 0 || !BASE64_PATTERN.test(compact)) {
        throw new InvalidChangeError(`Conteúdo de "${path}" não é base64 válido.`, "INVALID_CONTENT_ENCODING")
    }
    return Buffer.from(compact, "base64")
}

const AssertPath = (value: unknown, { maxPathBytes }: ChangeLimits, label = "caminho"): string => {
    if (typeof value !== "string") throw new InvalidChangeError(`Informe o ${label} do arquivo.`, "INVALID_PATH")

    const cleaned = value.trim().replace(/^\/+/, "").replace(/\/+$/, "")
    if (cleaned === "") throw new InvalidChangeError(`O ${label} não pode ser vazio.`, "INVALID_PATH")
    if (Buffer.byteLength(cleaned) > maxPathBytes) throw new InvalidChangeError(`O ${label} é longo demais.`, "INVALID_PATH")
    // Caractere de controle em nome de arquivo quebra o parsing de qualquer
    // saída de git delimitada por linha, inclusive a nossa.
    if (/[\u0000-\u001f\u007f]/.test(cleaned)) throw new InvalidChangeError(`O ${label} tem caractere inválido.`, "INVALID_PATH")

    const segments = cleaned.split("/")
    for (const segment of segments) {
        if (segment === "" || segment === "." || segment === "..") {
            throw new InvalidChangeError(`O ${label} "${cleaned}" sai do repositório.`, "INVALID_PATH")
        }
        /*
            `.git` em qualquer nível é recusado mesmo sendo, tecnicamente, apenas
            uma entrada de árvore: um commit que traz `.git/config` ou
            `.git/hooks/post-checkout` vira execução de código na máquina de quem
            clonar. Comparação sem caso porque sistema de arquivos
            insensível a caso transforma `.GIT` no mesmo diretório.
        */
        if (segment.toLowerCase() === ".git") {
            throw new InvalidChangeError(`O ${label} não pode entrar em ".git".`, "FORBIDDEN_PATH")
        }
    }
    return segments.join("/")
}

const AssertMode = (value: unknown, path: string): string | undefined => {
    if (value === undefined || value === null) return undefined
    const mode = String(value)
    if (ALLOWED_MODES.has(mode)) return mode
    /*
        Symlink (120000) e submódulo (160000) ficam de fora porque nenhum dos
        dois é editável por um editor de texto e os dois viajam mal: um link
        simbólico commitado pela tela pode apontar para fora da árvore no
        checkout de quem clonar, e um gitlink referencia um repositório que este
        serviço não tem como buscar. Quem precisar deles usa `git push`.
    */
    if (mode === "120000") throw new InvalidChangeError(`Link simbólico não pode ser criado pela tela ("${path}").`, "UNSUPPORTED_MODE")
    if (mode === "160000") throw new InvalidChangeError(`Submódulo não pode ser criado pela tela ("${path}").`, "UNSUPPORTED_MODE")
    throw new InvalidChangeError(`Modo de arquivo inválido em "${path}".`, "UNSUPPORTED_MODE")
}

const AssertExpectedOid = (value: unknown, path: string): string | null | undefined => {
    if (value === undefined) return undefined
    // `null` é afirmação, não ausência: "este arquivo não deve existir ainda".
    // É o que distingue "criar novo" de "sobrescrever".
    if (value === null) return null
    if (typeof value !== "string" || !/^[0-9a-f]{40}$/i.test(value)) {
        throw new InvalidChangeError(`Identificador de conteúdo inválido em "${path}".`, "INVALID_EXPECTED_OID")
    }
    return value.toLowerCase()
}

const NormalizeMessage = (value: unknown, { maxMessageBytes }: ChangeLimits): string => {
    if (typeof value !== "string" || value.trim() === "") {
        throw new InvalidChangeError("Informe a mensagem do commit.", "INVALID_MESSAGE")
    }
    const message = (value as string).replace(/\r\n/g, "\n").trim()
    if (Buffer.byteLength(message) > maxMessageBytes) {
        throw new InvalidChangeError("A mensagem do commit é longa demais.", "INVALID_MESSAGE")
    }
    return message
}

const NormalizeChangeSet = (changes: RawChange[], limitOverrides: Partial<ChangeLimits> = {}): NormalizedChange[] => {
    const limits = { ...DEFAULT_LIMITS, ...limitOverrides }

    if (!Array.isArray(changes) || changes.length === 0) {
        throw new InvalidChangeError("Informe ao menos uma mudança.", "EMPTY_CHANGE_SET")
    }
    if (changes.length > limits.maxChanges) {
        throw new InvalidChangeError(`Um commit aceita no máximo ${limits.maxChanges} mudanças.`, "TOO_MANY_CHANGES")
    }

    const normalized: NormalizedChange[] = []
    /*
        Um caminho só pode aparecer uma vez no change set, contando origem E
        destino de `move`. Duas mudanças no mesmo caminho têm resultado que
        depende da ordem de aplicação — e a ordem é detalhe de implementação
        nosso, não contrato de quem chama. Recusar é honesto; escolher uma
        ordem em silêncio é o tipo de coisa que só aparece em produção.
    */
    const seen = new Map<string, string>()
    const Claim = (path: string, operation: string) => {
        if (seen.has(path)) {
            throw new InvalidChangeError(`O caminho "${path}" aparece em mais de uma mudança (${seen.get(path)} e ${operation}).`, "DUPLICATE_PATH")
        }
        seen.set(path, operation)
    }

    let totalBytes = 0

    for (const change of changes) {
        const operation = change?.op
        if (!OPERATIONS.has(operation as string)) {
            throw new InvalidChangeError(`Operação desconhecida: ${JSON.stringify(operation ?? null)}.`, "UNKNOWN_OPERATION")
        }

        const path = AssertPath(change.path, limits)
        Claim(path, operation as string)

        if (operation === "put") {
            const hasBase64 = typeof change.contentBase64 === "string"
            const hasText = typeof change.content === "string"
            if (!hasBase64 && !hasText) {
                throw new InvalidChangeError(`Informe o conteúdo de "${path}".`, "MISSING_CONTENT")
            }
            const content = hasBase64 ? DecodeBase64(change.contentBase64 as string, path) : Buffer.from(change.content as string, "utf8")
            if (content.length > limits.maxFileBytes) {
                throw new InvalidChangeError(`"${path}" passa do limite de ${limits.maxFileBytes} bytes por arquivo.`, "FILE_TOO_LARGE")
            }
            totalBytes += content.length
            if (totalBytes > limits.maxTotalBytes) {
                throw new InvalidChangeError(`O commit passa do limite de ${limits.maxTotalBytes} bytes.`, "CHANGE_SET_TOO_LARGE")
            }
            normalized.push({
                op: "put", path, content,
                mode: AssertMode(change.mode, path),
                expectedOid: AssertExpectedOid(change.expectedOid, path)
            })
            continue
        }

        if (operation === "delete") {
            normalized.push({
                op: "delete", path,
                recursive: change.recursive === true,
                expectedOid: AssertExpectedOid(change.expectedOid, path)
            })
            continue
        }

        const newPath = AssertPath(change.newPath, limits, "novo caminho")
        if (newPath === path) throw new InvalidChangeError(`Origem e destino iguais em "${path}".`, "INVALID_MOVE")
        Claim(newPath, "move")
        normalized.push({
            op: "move", path, newPath,
            expectedOid: AssertExpectedOid(change.expectedOid, path)
        })
    }

    AssertNoOverlappingScopes(normalized)

    return normalized
}

/*
    Caminho distinto não basta: apagar "src" recursivamente e gravar
    "src/App.js" no mesmo commit são dois caminhos diferentes cujo resultado
    depende de qual for aplicado primeiro. A ordem de aplicação é decisão
    interna nossa, então aceitar o par seria prometer um resultado que não está
    no contrato. Vale para `delete` recursivo e para as duas pontas de `move`,
    que carregam a subárvore inteira.
*/
const AssertNoOverlappingScopes = (normalizedChanges: NormalizedChange[]) => {
    const prefixes = ChangeScopes(normalizedChanges)
        .filter(({ prefix }) => prefix)
        .map(({ path }) => path)

    for (const scope of prefixes) {
        for (const change of normalizedChanges) {
            for (const path of change.op === "move" ? [change.path, change.newPath] : [change.path]) {
                if (path !== scope && path.startsWith(`${scope}/`)) {
                    throw new InvalidChangeError(
                        `"${path}" está dentro de "${scope}", que o mesmo commit move ou apaga inteiro.`,
                        "OVERLAPPING_PATHS")
                }
            }
        }
    }
}

/*
    ESCOPO de uma mudança, para decidir conflito.

    Um `delete` recursivo e um `move` de diretório valem para tudo abaixo do
    caminho, então comparar só o caminho exato deixaria passar conflito real.
    Cada mudança devolve um prefixo (`"a/b/"`) ou um caminho exato, e a
    interseção é calculada sobre isso.
*/
const ChangeScopes = (normalizedChanges: NormalizedChange[]): ChangeScope[] => normalizedChanges.flatMap((change): ChangeScope[] => {
    if (change.op === "delete") return [{ path: change.path, prefix: change.recursive }]
    if (change.op === "move") return [{ path: change.path, prefix: true }, { path: change.newPath, prefix: true }]
    return [{ path: change.path, prefix: false }]
})

const IntersectsChangedPaths = (normalizedChanges: NormalizedChange[], changedPaths: string[]): string[] => {
    const scopes = ChangeScopes(normalizedChanges)
    return changedPaths.filter((changedPath) => scopes.some(({ path, prefix }) =>
        changedPath === path || (prefix && changedPath.startsWith(`${path}/`))))
}

module.exports = NormalizeChangeSet
module.exports.NormalizeMessage = NormalizeMessage
module.exports.ChangeScopes = ChangeScopes
module.exports.IntersectsChangedPaths = IntersectsChangedPaths
module.exports.DEFAULT_LIMITS = DEFAULT_LIMITS
module.exports.ALLOWED_MODES = ALLOWED_MODES
