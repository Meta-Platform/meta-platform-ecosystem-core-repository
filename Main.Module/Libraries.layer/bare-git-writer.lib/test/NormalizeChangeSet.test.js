const test = require("node:test")
const assert = require("node:assert")

const NormalizeChangeSet = require("../src/NormalizeChangeSet")
const { NormalizeMessage, IntersectsChangedPaths, DEFAULT_LIMITS } = NormalizeChangeSet

const Put = (path, content = "conteudo") => ({ op: "put", path, content })

const AssertRefused = (changes, code) => {
    assert.throws(() => NormalizeChangeSet(changes), (error) => {
        assert.strictEqual(error.code, code, `esperava ${code}, veio ${error.code}: ${error.message}`)
        assert.strictEqual(error.statusCode, 400)
        return true
    })
}

test("normaliza caminho com barras sobrando e devolve conteúdo como Buffer", () => {
    const [change] = NormalizeChangeSet([Put("/src/App.js/")])
    assert.strictEqual(change.path, "src/App.js")
    assert.ok(Buffer.isBuffer(change.content))
    assert.strictEqual(change.content.toString("utf8"), "conteudo")
})

test("aceita base64 e recusa base64 corrompido em vez de gravar outro arquivo", () => {
    const [change] = NormalizeChangeSet([{ op: "put", path: "a.bin", contentBase64: "AAECAw==" }])
    assert.deepStrictEqual([...change.content], [0, 1, 2, 3])

    // `Buffer.from` ignoraria os caracteres inválidos e produziria um arquivo
    // diferente do que foi enviado, sem avisar ninguém.
    AssertRefused([{ op: "put", path: "a.bin", contentBase64: "AA!!ECAw==" }], "INVALID_CONTENT_ENCODING")
    AssertRefused([{ op: "put", path: "a.bin", contentBase64: "AAECA" }], "INVALID_CONTENT_ENCODING")
})

test("recusa caminho que sai do repositório", () => {
    AssertRefused([Put("../fora.js")], "INVALID_PATH")
    AssertRefused([Put("src/../../fora.js")], "INVALID_PATH")
    AssertRefused([Put("./aqui.js")], "INVALID_PATH")
    AssertRefused([Put("")], "INVALID_PATH")
})

test("recusa qualquer variação de .git", () => {
    AssertRefused([Put(".git/config")], "FORBIDDEN_PATH")
    AssertRefused([Put(".GIT/hooks/post-checkout")], "FORBIDDEN_PATH")
    AssertRefused([Put("src/.git/config")], "FORBIDDEN_PATH")
})

test("recusa caractere de controle no caminho", () => {
    AssertRefused([Put("src/App\n.js")], "INVALID_PATH")
    AssertRefused([Put("src/App\u0000.js")], "INVALID_PATH")
})

test("aceita caminho com vírgula, acento e espaço", () => {
    const paths = ["docs/lista,de,itens.md", "docs/ação e reação.md", "a b/c d.txt"]
    const normalized = NormalizeChangeSet(paths.map((path) => Put(path)))
    assert.deepStrictEqual(normalized.map(({ path }) => path), paths)
})

test("recusa symlink e submódulo com mensagem específica", () => {
    AssertRefused([{ ...Put("link"), mode: "120000" }], "UNSUPPORTED_MODE")
    AssertRefused([{ ...Put("sub"), mode: "160000" }], "UNSUPPORTED_MODE")
    AssertRefused([{ ...Put("x"), mode: "100600" }], "UNSUPPORTED_MODE")
    assert.strictEqual(NormalizeChangeSet([{ ...Put("run.sh"), mode: "100755" }])[0].mode, "100755")
})

test("recusa o mesmo caminho duas vezes, inclusive como destino de move", () => {
    AssertRefused([Put("a.js"), Put("a.js")], "DUPLICATE_PATH")
    AssertRefused([Put("b.js"), { op: "move", path: "a.js", newPath: "b.js" }], "DUPLICATE_PATH")
    AssertRefused([{ op: "move", path: "a.js", newPath: "a.js" }], "INVALID_MOVE")
})

test("recusa mudança dentro de caminho que o mesmo commit apaga ou move inteiro", () => {
    AssertRefused([
        { op: "delete", path: "src", recursive: true },
        Put("src/App.js")
    ], "OVERLAPPING_PATHS")

    AssertRefused([
        { op: "move", path: "src", newPath: "app" },
        Put("src/App.js")
    ], "OVERLAPPING_PATHS")

    // Delete NÃO recursivo vale só para o caminho exato, então não há ambiguidade.
    assert.strictEqual(NormalizeChangeSet([
        { op: "delete", path: "src/Old.js" },
        Put("src/New.js")
    ]).length, 2)
})

test("aplica os tetos de tamanho e de quantidade", () => {
    AssertRefused([], "EMPTY_CHANGE_SET")
    AssertRefused([{ op: "cheirar", path: "a.js" }], "UNKNOWN_OPERATION")
    AssertRefused([Put("a.js")].concat(new Array(DEFAULT_LIMITS.maxChanges).fill(0).map((_, i) => Put(`f${i}.js`))), "TOO_MANY_CHANGES")

    const grande = "x".repeat(DEFAULT_LIMITS.maxFileBytes + 1)
    AssertRefused([Put("grande.txt", grande)], "FILE_TOO_LARGE")
})

test("expectedOid: hex aceito, null é afirmação de ausência, lixo é recusado", () => {
    const oid = "a".repeat(40)
    assert.strictEqual(NormalizeChangeSet([{ ...Put("a.js"), expectedOid: oid.toUpperCase() }])[0].expectedOid, oid)
    assert.strictEqual(NormalizeChangeSet([{ ...Put("a.js"), expectedOid: null }])[0].expectedOid, null)
    assert.strictEqual(NormalizeChangeSet([Put("a.js")])[0].expectedOid, undefined)
    AssertRefused([{ ...Put("a.js"), expectedOid: "nao-e-oid" }], "INVALID_EXPECTED_OID")
})

test("mensagem de commit é obrigatória e normaliza CRLF", () => {
    assert.strictEqual(NormalizeMessage("  assunto\r\n\r\ncorpo  ", DEFAULT_LIMITS), "assunto\n\ncorpo")
    for (const invalid of ["", "   ", undefined, null, 42]) {
        assert.throws(() => NormalizeMessage(invalid, DEFAULT_LIMITS), { code: "INVALID_MESSAGE" })
    }
})

test("interseção de escopo enxerga arquivo dentro de diretório apagado", () => {
    const changes = NormalizeChangeSet([
        Put("src/App.js"),
        { op: "delete", path: "docs", recursive: true }
    ])

    assert.deepStrictEqual(IntersectsChangedPaths(changes, ["README.md"]), [])
    assert.deepStrictEqual(IntersectsChangedPaths(changes, ["src/App.js"]), ["src/App.js"])
    // O outro lado mexeu num arquivo abaixo de "docs", que este commit remove inteiro.
    assert.deepStrictEqual(IntersectsChangedPaths(changes, ["docs/guia/uso.md"]), ["docs/guia/uso.md"])
    // "src/Outro.js" não está no change set: mudança do outro lado não colide.
    assert.deepStrictEqual(IntersectsChangedPaths(changes, ["src/Outro.js"]), [])
})
