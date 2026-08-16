const test = require("node:test")
const assert = require("node:assert")

const {
    GetMetadataSchema, GetFileSpec, GetRequiredFiles, ResolveFileSpecForPath,
    ValidateMetadataCrossFile, ValidateMetadataFile, ValidateMetadataFiles
} = require("../src/index")

/*
    O QUE ESTES CASOS PROTEGEM

    Um validador de metadados falha de duas formas, e as duas são caras:

      FALSO NEGATIVO  deixa passar o que quebra o boot em runtime — e o sintoma
                      aparece longe da causa (socket que não abre, serviço que
                      fica STARTING para sempre). É o caso do param declarado sem
                      valor em startup-params.
      FALSO POSITIVO  acusa problema onde não há, e aí a lista de avisos deixa de
                      ser lida. É o caso de cobrar `windows` de um boot.json que
                      não tem janela, ou de cruzar o boot de um pacote com o
                      startup-params de outro.

    Metade dos casos abaixo é sobre o segundo — porque é o que faz um validador
    ser desligado mentalmente por quem usa.
*/

test("o esquema é dado, versionado, e cobre os cinco arquivos conhecidos", () => {
    const schema = GetMetadataSchema()
    assert.equal(schema.schemaVersion, 1)
    const files = schema.files.map((spec) => spec.file).sort()
    assert.deepEqual(files, [
        "metadata/boot.json",
        "metadata/command-group.json",
        "metadata/endpoint-group.json",
        "metadata/package.json",
        "metadata/services.json"
    ])
    assert.deepEqual(schema.referencePrefixes, ["@/", "@@/", "@//"])
})

test("o esquema devolvido é cópia: mutar o resultado não contamina o próximo pedido", () => {
    const first = GetMetadataSchema()
    first.files.length = 0
    assert.ok(GetMetadataSchema().files.length >= 5,
        "sem cópia defensiva, um consumidor distraído derrubaria o contrato do processo inteiro")
})

test("o caminho do pacote casa pelo sufixo", () => {
    const spec = ResolveFileSpecForPath("Main.Module/Libraries.layer/x.lib/metadata/boot.json")
    assert.ok(spec)
    assert.equal(spec.file, "metadata/boot.json")
    assert.equal(ResolveFileSpecForPath("src/Servico.js"), undefined)
    assert.equal(ResolveFileSpecForPath(""), undefined)
})

test("campo obrigatório vazio é erro, com o nome do campo e o índice do item", () => {
    const issues = ValidateMetadataFile("metadata/boot.json", {
        services: [{ namespace: "@/a.service" }]
    })
    assert.equal(issues.length, 1)
    assert.equal(issues[0].level, "error")
    assert.equal(issues[0].field, "Dependency")
    assert.equal(issues[0].index, 0, "sem o índice, a tela não sabe qual dos serviços reclamar")
})

test("referência sem prefixo é erro; com prefixo válido, silêncio", () => {
    const ruim = ValidateMetadataFile("metadata/boot.json", {
        services: [{ namespace: "a.service", dependency: "@/a.service" }]
    })
    assert.equal(ruim.length, 1)
    assert.ok(ruim[0].message.indexOf("não resolve") > 0)

    for (const prefixo of ["@/", "@@/", "@//"]) {
        const bom = ValidateMetadataFile("metadata/boot.json", {
            services: [{ namespace: `${prefixo}a.service`, dependency: `${prefixo}a.service` }]
        })
        assert.deepEqual(bom, [], `${prefixo} é prefixo válido e não pode virar erro`)
    }
})

test("entidade ausente no documento não gera problema", () => {
    // Um boot.json sem `windows` não tem problema de windows. Cobrar isso faria a
    // lista de avisos encher de ruído em todo pacote que não é desktop.
    assert.deepEqual(ValidateMetadataFile("metadata/boot.json", { params: [] }), [])
})

test("lista na raiz (services.json) e objeto único (package.json) são entendidos", () => {
    const raiz = ValidateMetadataFile("metadata/services.json", [
        { namespace: "x", path: "Services/X.service" },
        { namespace: "y" }
    ])
    assert.equal(raiz.length, 1, "só o segundo item está incompleto")
    assert.equal(raiz[0].index, 1)

    const objeto = ValidateMetadataFile("metadata/package.json", {})
    assert.equal(objeto.length, 1)
    assert.equal(objeto[0].field, "Namespace")
})

test("lista de strings: a própria entrada é o valor", () => {
    const issues = ValidateMetadataFile("metadata/boot.json", { params: ["porta", "", "?opcional"] })
    assert.equal(issues.length, 1, "só a string vazia é problema")
    assert.equal(issues[0].index, 1)
})

test("arquivo desconhecido e documento nulo não geram problema nem exceção", () => {
    assert.deepEqual(ValidateMetadataFile("metadata/nao-existe.json", { qualquer: 1 }), [])
    assert.deepEqual(ValidateMetadataFile("metadata/boot.json", null), [])
    assert.deepEqual(ValidateMetadataFile("metadata/boot.json", undefined), [])
})

test("param do boot sem valor em startup-params é aviso — o erro que aparece longe da causa", () => {
    const issues = ValidateMetadataCrossFile({
        "metadata/boot.json": { params: ["porta", "?opcional", "socketPath"] },
        "metadata/startup-params.json": { porta: "7014" }
    })
    const faltando = issues.filter((issue) => issue.message.indexOf("socketPath") > 0)
    assert.equal(faltando.length, 1)
    assert.equal(faltando[0].level, "warning", "avisa, nunca bloqueia")

    const opcional = issues.filter((issue) => issue.message.indexOf("opcional") > 0)
    assert.deepEqual(opcional, [], "param com ? é opcional: ausência é o esperado")
})

test("valor em startup-params que o boot não declara é aviso de valor morto", () => {
    const issues = ValidateMetadataCrossFile({
        "metadata/boot.json": { params: ["porta"] },
        "metadata/startup-params.json": { porta: "7014", sobrou: "x" }
    })
    const mortos = issues.filter((issue) => issue.file === "metadata/startup-params.json")
    assert.equal(mortos.length, 1)
    assert.ok(mortos[0].message.indexOf("sobrou") > 0)
})

test("arquivo com erro de leitura não vira aviso falso na checagem cruzada", () => {
    const issues = ValidateMetadataCrossFile({
        "metadata/boot.json": { params: ["porta"] },
        "metadata/startup-params.json": { __error: "não foi possível ler" }
    })
    assert.deepEqual(issues, [],
        "sem o conteúdo real do startup-params, afirmar que falta valor seria adivinhar")
})

test("startup-params AUSENTE é caso diferente de ilegível: aí o aviso está certo", () => {
    // O arquivo não existe, então o param realmente não tem valor — e é
    // exatamente esse o aviso que se quer ver antes de provisionar.
    const issues = ValidateMetadataCrossFile({
        "metadata/boot.json": { params: ["porta"] }
    })
    assert.equal(issues.length, 1)
    assert.equal(issues[0].level, "warning")
    assert.ok(issues[0].message.indexOf("porta") > 0)
})

test("lote: JSON inválido é reportado com o caminho do arquivo, sem derrubar o resto", () => {
    const issues = ValidateMetadataFiles({
        "Main.Module/Libraries.layer/x.lib/metadata/package.json": "{ isto não é json",
        "Main.Module/Libraries.layer/y.lib/metadata/package.json": JSON.stringify({ namespace: "@/y.lib" })
    })
    assert.equal(issues.length, 1)
    assert.equal(issues[0].file, "Main.Module/Libraries.layer/x.lib/metadata/package.json")
    assert.ok(issues[0].message.indexOf("JSON inválido") === 0)
})

test("lote: o problema volta com o caminho REAL, não com o do esquema", () => {
    const path = "Main.Module/Applications.layer/z.webapp/metadata/boot.json"
    const issues = ValidateMetadataFiles({ [path]: { services: [{ namespace: "@/a.service" }] } })
    assert.equal(issues.length, 1)
    assert.equal(issues[0].file, path, "com três boot.json no lote, o esquema não diria qual é")
})

test("lote: a checagem cruzada é por pacote, não entre pacotes", () => {
    /*
        O caso que produziria uma enxurrada de aviso falso: o boot de A comparado
        com o startup-params de B. Aqui A está completo e B está completo; um
        agrupamento errado acusaria os dois.
    */
    const issues = ValidateMetadataFiles({
        "M.Module/L.layer/a.webapp/metadata/boot.json": { params: ["porta"] },
        "M.Module/L.layer/a.webapp/metadata/startup-params.json": { porta: "1" },
        "M.Module/L.layer/b.webapp/metadata/boot.json": { params: ["host"] },
        "M.Module/L.layer/b.webapp/metadata/startup-params.json": { host: "x" }
    })
    assert.deepEqual(issues, [])
})

test("lote: sem os dois arquivos do par, não há cruzamento", () => {
    const issues = ValidateMetadataFiles({
        "M.Module/L.layer/a.webapp/metadata/boot.json": { params: ["porta"] }
    })
    assert.deepEqual(issues, [],
        "avisar que falta startup-params.json quando ele não foi enviado é inventar problema")
})

test("arquivos obrigatórios por tipo de pacote", () => {
    assert.deepEqual(GetRequiredFiles("lib"), ["package.json", "metadata/package.json"])
    assert.ok(GetRequiredFiles("webservice").indexOf("metadata/endpoint-group.json") >= 0)
    assert.ok(GetRequiredFiles("service").indexOf("metadata/services.json") >= 0)
    assert.ok(GetRequiredFiles("tipo-que-nao-existe").length > 0, "tipo desconhecido cai no mínimo comum")
})

test("todo campo do contrato tem nome, rótulo e tipo conhecido", () => {
    // Contrato do próprio dado: um `kind` novo escrito com erro de digitação
    // passaria por tudo e renderizaria um campo de texto em silêncio.
    const KINDS = ["text", "reference", "boolean", "map", "list"]
    for (const spec of GetMetadataSchema().files) {
        assert.ok(spec.title, `${spec.file} sem título`)
        for (const entity of spec.entities) {
            assert.ok(entity.id && entity.title, `${spec.file}: entidade sem id ou título`)
            assert.ok(entity.fields.length > 0, `${entity.id} sem campo`)
            for (const field of entity.fields) {
                assert.equal(typeof field.name, "string", `${entity.id}: campo sem nome`)
                assert.ok(field.label, `${entity.id}: campo sem rótulo`)
                assert.ok(KINDS.indexOf(field.kind) >= 0, `${entity.id}.${field.name}: kind "${field.kind}" desconhecido`)
            }
        }
    }
})

test("GetFileSpec não devolve o objeto interno", () => {
    const spec = GetFileSpec("metadata/boot.json")
    spec.entities.length = 0
    assert.ok(GetFileSpec("metadata/boot.json").entities.length > 0)
})
