/**
 * As formas do contrato dos metadados — o mesmo dado que o `field-sets.json`
 * carrega e que o formulário do editor desenha.
 */

export type FieldKind = "text" | "reference" | string

export type FieldSpec = {
    /** Vazio quando a própria entrada é o valor (lista de strings). */
    name: string
    label: string
    kind?: FieldKind
    required?: boolean
}

export type EntitySpec = {
    title: string
    /** "@root", "" (o documento é a lista) ou a chave onde a lista está. */
    path: string
    fields: FieldSpec[]
}

export type FileSpec = {
    file: string
    entities: EntitySpec[]
}

/** Um aviso. Esta lib AVISA, não bloqueia — ver o cabeçalho da validação. */
export type Issue = {
    file: string
    entity: string
    index?: number
    field?: string
    level: "error" | "warning"
    message: string
}
