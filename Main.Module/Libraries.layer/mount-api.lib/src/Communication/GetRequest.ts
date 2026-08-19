import type { ApiCall, ApiParameter } from "../Types"

const querystring = require('querystring') as typeof import('querystring')
const http = require('http') as typeof import('http')

const GetURLPath = (path: string, parameters?: ApiParameter[]): string =>
    parameters && parameters.length > 0
        ? parameters
            .filter((parameter) => (parameter.in == "path"))
            .reduce((path, parameter) => path.replace(`:${parameter.name}`, parameter.value), path)
        : path

const GetURLQuery = (path: string, parameters?: ApiParameter[]): string => {

    const newParameters = parameters && parameters
    .filter((parameter) => (parameter.in == "query" && parameter.value && parameter.value !== ""))

    if(newParameters && newParameters.length > 0){
        const values = newParameters.reduce((values: Record<string, string>, {name, value})=>{
            values[name] = typeof value !== "string" ? JSON.stringify(value) : value
            values[name] =  values[name] !== "{}"?values[name]:""
            return values
        }, {})

        return `${path}?${querystring.stringify(values)}`
    }else
        return path

}

const GetURL = (path: string, parameters?: ApiParameter[]): string =>
    GetURLQuery(GetURLPath(path, parameters), parameters)

const GetParametersWithData = (parameters: ApiParameter[] | undefined, data: any) => {

    return parameters && parameters.map((parameter)=>{
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]
        return parameter
    })

}

/*
    O ERRO DO OUTRO LADO CHEGA INTEIRO, OU NÃO CHEGA.

    Isto aqui montava `new Error("HTTP status 403: " + data)` — o corpo JSON
    virava texto dentro da mensagem, e `code`, `httpStatus` e `statusCode`
    sumiam. Quem chama testa exatamente esses campos para separar "o outro lado
    RECUSOU, e disse por quê" de "o outro lado não respondeu"; sem eles, toda
    recusa vira indisponibilidade.

    O custo disso foi medido em 19/08/2026: o Platform Manager devolvia
    `403 {"code":"PERMISSION_DENIED","message":"Operação recusada em 3
    camada(s): ring-policy, service-identity-permission,
    package-declared-permission."}` — uma resposta que diz precisamente o que
    conferir — e o painel exibia "O Platform Manager não respondeu", mandando
    quem depura procurar socket órfão e processo caído. A interface tem entrada
    de catálogo para PERMISSION_DENIED, com as três camadas explicadas; ela
    nunca era alcançada, porque a informação morria nesta linha.

    O `Error` continua sendo um `Error` (nada que dependia de `.message` quebra),
    só que agora carrega os campos estruturados quando o corpo é JSON com
    `code`. Corpo não-JSON ou sem `code` mantém exatamente o comportamento
    anterior, mais o `statusCode`.
*/
const BuildResponseError = (statusCode: number, rawBody: string): Error => {
    let corpo: any = undefined
    try { corpo = JSON.parse(rawBody) } catch { /* corpo não-JSON: segue como texto */ }

    const mensagem = corpo && typeof corpo.message === "string"
        ? corpo.message
        : `HTTP status ${statusCode}: ${rawBody}`

    const erro: any = new Error(mensagem)
    erro.statusCode = statusCode
    erro.httpStatus = statusCode
    erro.responseBody = rawBody
    if (corpo && typeof corpo.code === "string") erro.code = corpo.code
    return erro
}

const GetRequest = ({
    socketPath,
    method,
    path,
    parameters
}: {
    socketPath: string
    method: string
    path: string
    parameters?: ApiParameter[]
}): ApiCall => {
    return async (data: any) => {

        const immutableParameters = parameters && [...parameters.map(item => ({...item}))]

        const parametersWithData = GetParametersWithData(immutableParameters, data)

        const bodyValues = parametersWithData && parametersWithData
            .filter((parameter) => (parameter.in == "body"))
            .reduce((bodyValues: Record<string, any>, {name, value})=>{
                bodyValues[name] = value
                return bodyValues
            }, {})

        const url = GetURL(path, parametersWithData)

        return new Promise((resolve, reject) => {
            const options = {
                socketPath,
                path: url,
                method: method.toUpperCase(),
                headers: { 'Content-Type': 'application/json' }
            }

            const req = http.request(options, (res) => {
                let data = ''
                res.on('data', (chunk) => {
                    data += chunk
                })
                res.on('end', () => {
                    if (res.statusCode! >= 200 && res.statusCode! < 300)
                        try{
                            resolve(JSON.parse(data))
                        }catch(e){
                            resolve(data)
                        }
                    else
                        reject(BuildResponseError(res.statusCode!, data))
                })
            })

            req.on('error', (err) => reject(err))

            if (method.toLowerCase() !== 'get')
                req.write(JSON.stringify(bodyValues))

            req.end()

        })
    }
}

module.exports = GetRequest
