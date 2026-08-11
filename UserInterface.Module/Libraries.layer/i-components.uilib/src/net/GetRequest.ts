import axios from "axios"
import queryString from "query-string"

// Cliente HTTP dirigido pelo api.json: recebe a descrição de um endpoint
// (método, caminho, parâmetros) e devolve a função que o chama.
//
// Cada parâmetro declara ONDE entra na requisição:
//   in: "path"   → substitui `:nome` no caminho
//   in: "query"  → vira query string
//   in: "body"   → vira corpo (em DELETE viaja em { data }, exigência do axios)
//
// Era o `Utils/GetRequest.util.ts` copiado em 11 WebGui, em duas variantes que
// diferiam SÓ pelo apelido do import de query-string (`queryString` vs `qs`) —
// nenhuma diferença de comportamento.

export type RequestParameter = {
    name: string
    in: "path" | "query" | "body" | string
    value?: any
}

const GetURLPath = (path: string, parameters: Array<object>) =>
    parameters && parameters.length > 0
        ? parameters
            .filter((parameter: any) => (parameter.in == "path"))
            .reduce((path: string, parameter: any) => path.replace(`:${parameter.name}`, parameter.value), path)
        : path

const GetURLQuery = (path: string, parameters: Array<object>) => {
    const newParameters = parameters && parameters
        .filter((parameter: any) => (parameter.in == "query" && parameter.value && parameter.value !== ""))

    if(newParameters && newParameters.length > 0){
        const values = newParameters.reduce((values: any, { name, value }: any) => {
            values[name] = typeof value !== "string" ? JSON.stringify(value) : value
            values[name] = values[name] !== "{}" ? values[name] : ""
            return values
        }, {})

        return `${path}?${queryString.stringify(values, null as any)}`
    }else
        return path
}

export const GetURL = (path: string, parameters: Array<object>) =>
    GetURLQuery(GetURLPath(path, parameters), parameters)

// Copia os parâmetros declarados e preenche o `value` de cada um com o dado que
// o chamador passou. A cópia é feita pelo chamador (ver GetRequest), para que
// duas chamadas seguidas não disputem o mesmo objeto de parâmetros.
export const GetParametersWithData = (parameters: Array<any>, data: any) =>
    parameters && parameters.map((parameter) => {
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]

        return parameter
    })

export const GetRequest = (port: number, method: string, path: string, parameters: Array<object>) => {
    //TODO Corrigir esse localhost
    const Request: any = axios.create({
        baseURL: `http://localhost:${port === 80 ? "" : port}`
    })

    return (data: object) => {
        const immutableParameters = parameters && [ ...parameters.map((item) => ({ ...item })) ]
        const parametersWithData = GetParametersWithData(immutableParameters, data)
        const bodyValues = parametersWithData && parametersWithData
            .filter((parameter: any) => (parameter.in == "body"))
            .reduce((bodyValues: any, { name, value }: any) => {
                bodyValues[name] = value
                return bodyValues
            }, {})

        if(method.toLowerCase() === "delete")
            return Request[method.toLowerCase()](GetURL(path, parametersWithData), { data: bodyValues })
        else
            return Request[method.toLowerCase()](GetURL(path, parametersWithData), bodyValues)
    }
}

export default GetRequest
