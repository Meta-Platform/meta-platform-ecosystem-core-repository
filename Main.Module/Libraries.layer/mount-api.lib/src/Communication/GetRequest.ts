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
                        reject(new Error(`HTTP status ${res.statusCode}: ${data}`))
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
