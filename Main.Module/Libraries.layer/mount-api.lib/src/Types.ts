/**
 * As formas que esta lib recebe do servidor de recursos.
 *
 * Nada aqui é inventado: é o relatório de status que o `server-manager`
 * publica, descrito no dialeto do verificador. Quem cumpre o contrato é o
 * servidor; aqui só o afirmamos, para que o consumo dele seja checado.
 */

/** Parâmetro de um endpoint. `in` diz onde ele entra na requisição. */
export type ApiParameter = {
    name: string
    in: string
    value?: any
}

export type ApiEndpoint = {
    method: string
    path: string
    summary: string
    parameters?: ApiParameter[]
}

export type ApiTemplate = {
    name: string
    endpoints: ApiEndpoint[]
}

export type ServiceStatus = {
    serviceName: string
    path: string
    apiTemplate: ApiTemplate
}

export type ServerStatus = {
    name: string
    port?: number
    listServices: ServiceStatus[]
}

/** O relatório inteiro: um servidor por posição, com seus serviços. */
export type ServerServiceStatusReport = ServerStatus[]

/** Uma chamada já montada — HTTP ou, quando o método é WS, um socket. */
export type ApiCall = (data?: any) => any

/** As APIs de um serviço, indexadas pelo `summary` do endpoint. */
export type ServerAPIs = Record<string, ApiCall>

/**
 * Todas as APIs: servidor → serviço → chamada.
 *
 * O `undefined` no meio não é frouxidão: quando o serviço procurado não está no
 * relatório, a montagem devolve `undefined` ali em vez de um objeto vazio, e
 * quem consome precisa enxergar isso.
 */
export type MountedAPIs = Record<string, Record<string, ServerAPIs | undefined>>
