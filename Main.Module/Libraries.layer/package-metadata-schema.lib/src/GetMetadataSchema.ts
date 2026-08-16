import type { FileSpec } from "./Types"

const fieldSets = require("./schema/field-sets.json")

/*
    O CONTRATO DOS METADADOS, como DADO.

    Os campos de cada arquivo de metadados (boot.json, services.json,
    endpoint-group.json, command-group.json, package.json) vivem num JSON, e não
    em código, por um motivo concreto: quem valida é o servidor e quem desenha o
    formulário é o navegador. Com o contrato em dado, o formulário é gerado dos
    MESMOS bytes que a validação usa — sem isso, as duas metades divergem e a
    tela passa a aceitar o que o servidor recusa (ou o contrário, que é pior:
    aceita e quebra no boot).

    Por que isto vale existir: o formato do boot.json é o contrato mais frágil do
    ecossistema. Nome de param que não casa com startup-params derruba o boot em
    runtime; `@/` trocado por `@@/` muda o significado da resolução; bound-param
    opcional referenciado sem provedor quebra o provisionamento, e só aparece no
    reprovisionamento. Cada um desses é caro de descobrir e barato de recusar
    antes de gravar.

    O que esta lib NÃO faz, e não deve passar a fazer: dizer se um namespace
    EXISTE. Isso exige o índice do repositório, que é conhecimento de quem tem o
    repositório na mão — aqui só há o contrato.
*/

const SCHEMA_VERSION = fieldSets.schemaVersion

// Cópia defensiva: o objeto devolvido vai para dentro de uma resposta HTTP e para
// dentro de formulários. Um consumidor que o mutasse (ordenar campos, por
// exemplo) mudaria o contrato para todos os pedidos seguintes do processo.
const Clone = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value))

const GetMetadataSchema = () => Clone({
    schemaVersion     : SCHEMA_VERSION,
    referencePrefixes : fieldSets.referencePrefixes,
    referenceHint     : fieldSets.referenceHint,
    files             : fieldSets.files,
    requiredFilesByPackageType : fieldSets.requiredFilesByPackageType
})

const GetFileSpec = (file: string): FileSpec | undefined => {
    const found = (fieldSets.files || []).filter((spec: FileSpec) => spec.file === file)[0]
    return found ? Clone(found) : undefined
}

/*
    Casa pelo SUFIXO: o esquema fala de "metadata/boot.json", e o caminho que
    chega é "Modulo.Module/Layer.layer/x.lib/metadata/boot.json". Sem isto, o
    esquema teria que conhecer caminhos de pacote, e passaria a depender da
    convenção de diretórios para validar o conteúdo de um arquivo.
*/
const ResolveFileSpecForPath = (path: unknown): FileSpec | undefined => {
    if (typeof path !== "string" || path === "") return undefined
    const normalized = path.replace(/\\/g, "/")
    const match = /(metadata\/[^/]+\.json)$/.exec(normalized)
    if (!match) return undefined
    return GetFileSpec(match[1])
}

const IsKnownMetadataFile = (file: string) => !!GetFileSpec(file)

const GetRequiredFiles = (packageType: string): string[] => {
    const table = fieldSets.requiredFilesByPackageType || {}
    return Clone(table[packageType] || table.lib || [])
}

module.exports = {
    SCHEMA_VERSION,
    GetMetadataSchema,
    GetFileSpec,
    ResolveFileSpecForPath,
    IsKnownMetadataFile,
    GetRequiredFiles
}
