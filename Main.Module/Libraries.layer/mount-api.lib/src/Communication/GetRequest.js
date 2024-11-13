const querystring = require('querystring')
const http = require('http')

const getURLPath = (path, parameters) => 
parameters && parameters.length > 0
? parameters
    .filter((parameter) => (parameter.in == "path"))
    .reduce((path, parameter) => path.replace(`:${parameter.name}`, parameter.value), path)
: path

const getURLQuery = (path, parameters) => {
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

const getURL = (path, parameters) => {
    return getURLQuery(getURLPath(path, parameters), parameters)
}

const getParametersWithData = (parameters, data) => {
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
        const agent = new http.Agent({ socketPath })
        const immutableParameters = parameters && [...parameters.map(item => ({...item}))]
        const parametersWithData = getParametersWithData(immutableParameters, data)
        const bodyValues = parametersWithData && parametersWithData
        .filter((parameter) => (parameter.in == "body"))
        .reduce((bodyValues, {name, value})=>{
            bodyValues[name] = value
            return bodyValues
        }, {})
        const url = `http://localhost${getURL(path, parametersWithData)}`;
        const options = {
            agent,
            method: method.toLowerCase(),
            headers: { 'Content-Type': 'application/json' },
            body: method.toLowerCase() !== "get"
                    ? JSON.stringify(method.toLowerCase() === "delete" ? ({data:bodyValues}) : bodyValues)
                    : undefined
        }
        const response = await fetch(url, options)
        if (!response.ok) {
            throw response
        }
        return await response.json()
    }
}

module.exports = GetRequest