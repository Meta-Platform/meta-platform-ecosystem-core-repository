const querystring = require('querystring')
const http = require('http')

const GetURLPath = (path, parameters) => 
    parameters && parameters.length > 0
        ? parameters
            .filter((parameter) => (parameter.in == "path"))
            .reduce((path, parameter) => path.replace(`:${parameter.name}`, parameter.value), path)
        : path

const GetURLQuery = (path, parameters) => {

    const newParameters = parameters && parameters
    .filter((parameter) => (parameter.in == "query" && parameter.value && parameter.value !== ""))

    if(newParameters && newParameters.length > 0){
        const values = newParameters.reduce((values, {name, value})=>{
            values[name] = typeof value !== "string" ? JSON.stringify(value) : value
            values[name] =  values[name] !== "{}"?values[name]:""
            return values
        }, {})

        return `${path}?${querystring.stringify(values, null)}`
    }else
        return path

}

const GetURL = (path, parameters) => 
    GetURLQuery(GetURLPath(path, parameters), parameters)

const GetParametersWithData = (parameters, data) => {

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
}) => {
    return async (data) => {

        const immutableParameters = parameters && [...parameters.map(item => ({...item}))]

        const parametersWithData = GetParametersWithData(immutableParameters, data)

        const bodyValues = parametersWithData && parametersWithData
            .filter((parameter) => (parameter.in == "body"))
            .reduce((bodyValues, {name, value})=>{
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
                    if (res.statusCode >= 200 && res.statusCode < 300) 
                        resolve(JSON.parse(data))
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