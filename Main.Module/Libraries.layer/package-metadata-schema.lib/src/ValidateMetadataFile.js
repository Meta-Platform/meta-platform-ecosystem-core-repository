const fieldSets = require("./schema/field-sets.json")
const { GetFileSpec, ResolveFileSpecForPath } = require("./GetMetadataSchema")

/*
    VALIDAÇÃO DE UM ARQUIVO DE METADADOS.

    Regra de ouro desta lib: ela AVISA, não bloqueia. O nível é "error" para o que
    é certamente inválido (campo obrigatório vazio, referência com prefixo que não
    resolve) e "warning" para o que é suspeito. Quem chama decide o que fazer — e
    no caso do commit, a decisão já está tomada: nunca recusar por causa disto.

    O motivo é uma questão de ordem de trabalho: metadado incompleto é um estado
    NORMAL no meio da edição. Um pacote nasce com boot.json vazio e vai sendo
    preenchido; recusar o commit intermediário obrigaria a pessoa a terminar tudo
    de uma vez ou a contornar o editor. O aviso mostra o que falta sem impedir de
    guardar o caminho até lá.

    Só duas classes de erro são julgadas aqui, e as duas são decidíveis apenas com
    o arquivo em mãos:

      OBRIGATÓRIO VAZIO   o campo existe no contrato e não tem valor.
      PREFIXO DE REFERÊNCIA  `@/`, `@@/` ou `@//`. Um valor sem prefixo não
                          resolve — o boot falha ao montar, com uma mensagem que
                          fala de outro lugar.

    O que exigiria o repositório (aquele namespace existe? aquele arquivo está
    lá?) fica fora de propósito: ver o cabeçalho de GetMetadataSchema.js.
*/

const REFERENCE_PREFIXES = fieldSets.referencePrefixes || ["@/", "@@/", "@//"]

const IsBlank = (value) =>
    value === undefined || value === null || `${value}`.trim() === ""

const HasValidReferencePrefix = (value) =>
    REFERENCE_PREFIXES.some((prefix) => value.indexOf(prefix) === 0)

/*
    Itens de uma entidade. Três formas, e a diferença importa:

      "@root"  o próprio documento é a entidade (metadata/package.json);
      ""       o documento É a lista (metadata/services.json é array na raiz);
      "params" a lista está sob uma chave.

    Documento que não casa com a forma esperada devolve lista vazia em vez de
    erro: um boot.json sem `windows` não tem problema nenhum de windows.
*/
const ItemsOfEntity = (entity, data) => {
    if (entity.path === "@root") return [data]
    const raw = entity.path === "" ? data : (data && data[entity.path])
    return Array.isArray(raw) ? raw : []
}

const ValidateMetadataFile = (file, data) => {
    const spec = GetFileSpec(file) || ResolveFileSpecForPath(file)
    if (!spec) return []
    if (data === undefined || data === null) return []

    const issues = []

    for (const entity of spec.entities) {
        const items = ItemsOfEntity(entity, data)
        for (let index = 0; index < items.length; index++) {
            const item = items[index]
            for (const field of entity.fields) {
                // Campo sem nome: a própria entrada é o valor (lista de strings,
                // como `params` do boot.json).
                const value = field.name === "" ? item : (item && item[field.name])

                if (field.required && IsBlank(value)) {
                    issues.push({
                        file    : spec.file,
                        entity  : entity.title,
                        index,
                        field   : field.label,
                        level   : "error",
                        message : `${field.label} é obrigatório`
                    })
                    continue
                }

                if (field.kind === "reference" && typeof value === "string" && value.trim() !== ""
                    && !HasValidReferencePrefix(value)) {
                    issues.push({
                        file    : spec.file,
                        entity  : entity.title,
                        index,
                        field   : field.label,
                        level   : "error",
                        message : `${field.label} deve começar com ${REFERENCE_PREFIXES.join(", ")} — "${value}" não resolve`
                    })
                }
            }
        }
    }

    return issues
}

/*
    VALIDAÇÃO CRUZADA — entre arquivos, não dentro de um.

    Pega o erro mais caro do ecossistema, e o único que um editor de um arquivo só
    nunca veria: um `param` declarado no boot.json sem valor correspondente em
    startup-params.json. O pacote sobe, o parâmetro chega `undefined`, e o sintoma
    aparece longe da causa — um socket que não abre, um serviço que fica STARTING
    para sempre.

    O sentido contrário também vale a pena: valor em startup-params.json que o
    boot não declara é valor morto — foi renomeado no boot e ficou para trás, ou
    nunca foi lido. Os dois são "warning": nenhum dos dois é certeza de defeito, e
    a segunda metade pode ser param de outro consumidor.
*/
const ValidateMetadataCrossFile = (metadata) => {
    const issues = []
    const Read = (file) => {
        const content = metadata && metadata[file]
        if (!content || typeof content !== "object" || content.__error) return undefined
        return content
    }

    const boot = Read("metadata/boot.json")
    const startup = Read("metadata/startup-params.json")
    if (!boot || !Array.isArray(boot.params)) return issues

    /*
        ARQUIVO PRESENTE MAS ILEGÍVEL ≠ ARQUIVO AUSENTE, e a diferença muda a
        resposta:

          ausente   o arquivo não existe, então os params realmente não têm valor
                    — o aviso está certo e é justamente o que se quer ver;
          ilegível  (`__error`, JSON quebrado) não se sabe o que tem dentro, e
                    afirmar que falta valor seria adivinhar. Pior: encheria a
                    lista de avisos falsos exatamente quando há um problema real
                    de leitura para resolver primeiro.

        A versão anterior desta função tratava os dois como o mesmo caso. O teste
        pegou.
    */
    const startupIsPresentButUnreadable =
        !startup && !!(metadata && metadata["metadata/startup-params.json"])
    if (startupIsPresentButUnreadable) return issues

    const declaredNames = []
    for (let index = 0; index < boot.params.length; index++) {
        const name = boot.params[index]
        if (typeof name !== "string" || name.trim() === "") continue
        // `?` prefixa param OPCIONAL: ausência é o esperado, não problema.
        const optional = name.indexOf("?") === 0
        const bare = name.replace(/^\?/, "")
        declaredNames.push(bare)
        if (optional) continue
        const declared = startup && Object.prototype.hasOwnProperty.call(startup, bare)
        if (!declared) {
            issues.push({
                file    : "metadata/boot.json",
                entity  : "Params",
                index,
                level   : "warning",
                message : `parâmetro "${bare}" não tem valor em startup-params.json`
            })
        }
    }

    if (startup) {
        for (const key of Object.keys(startup)) {
            if (declaredNames.indexOf(key) < 0) {
                issues.push({
                    file    : "metadata/startup-params.json",
                    entity  : "Startup params",
                    level   : "warning",
                    message : `"${key}" tem valor mas o boot.json não declara esse parâmetro`
                })
            }
        }
    }

    return issues
}

/*
    Valida um LOTE: `{ "<caminho>": <conteúdo já parseado ou texto> }`.

    Aceita texto porque é o formato em que o conteúdo chega de um commit — e o
    JSON inválido precisa aparecer como problema do arquivo, e não como erro de
    quem chamou. Um `boot.json` que não parseia é o defeito mais comum de todos,
    e ele tem que ser reportado com o nome do arquivo, não derrubar a validação
    do lote inteiro.
*/
const ValidateMetadataFiles = (files) => {
    const issues = []
    const parsed = {}
    const paths = Object.keys(files || {})

    for (const path of paths) {
        const value = files[path]
        let data = value
        if (typeof value === "string") {
            try {
                data = JSON.parse(value)
            } catch (error) {
                issues.push({
                    file    : path,
                    entity  : "JSON",
                    level   : "error",
                    message : `JSON inválido: ${error.message}`
                })
                continue
            }
        }
        parsed[path] = data
        const spec = ResolveFileSpecForPath(path)
        if (!spec) continue
        for (const issue of ValidateMetadataFile(spec.file, data)) {
            // O caminho REAL volta na resposta, não o do esquema: quem pediu
            // precisa saber qual dos três boot.json do lote tem o problema.
            issues.push({ ...issue, file: path })
        }
    }

    /*
        A checagem cruzada é POR PACOTE: agrupa pelo prefixo antes de `metadata/`,
        senão o boot.json de um pacote seria comparado com o startup-params.json
        de outro — e o resultado seria um monte de aviso falso.
    */
    const byPackage = {}
    for (const path of Object.keys(parsed)) {
        const match = /^(.*?)metadata\/[^/]+\.json$/.exec(path.replace(/\\/g, "/"))
        if (!match) continue
        const prefix = match[1]
        const shortName = `metadata/${path.split("/").pop()}`
        byPackage[prefix] = byPackage[prefix] || {}
        byPackage[prefix][shortName] = parsed[path]
    }

    for (const prefix of Object.keys(byPackage)) {
        const group = byPackage[prefix]
        // Sem os DOIS arquivos no lote não há o que cruzar: avisar que falta
        // startup-params.json quando ele simplesmente não foi enviado seria
        // inventar problema.
        if (!group["metadata/boot.json"] || !group["metadata/startup-params.json"]) continue
        for (const issue of ValidateMetadataCrossFile(group)) {
            issues.push({ ...issue, file: `${prefix}${issue.file}` })
        }
    }

    return issues
}

module.exports = {
    ValidateMetadataFile,
    ValidateMetadataCrossFile,
    ValidateMetadataFiles
}
