const WebSocket = require('ws')

const GetRequest = require("./GetRequest")
//TODO Ja existe repetido
const getURLPath = (path, parameters) => 
parameters && parameters.length > 0
? parameters
    .filter((parameter) => (parameter.in == "path"))
    .reduce((path, parameter) => path.replace(`:${parameter.name}`, parameter.value), path)
: path

//TODO Ja existe repetido
const getParametersWithData = (parameters, data) => {
    return parameters && parameters.map((parameter)=>{
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]
        
        return parameter
    })
}

const getSocket = ({socketPath, path, parameters}) => 
	(data) => {
		const url = `ws+unix://${socketPath}:${getURLPath(path, getParametersWithData(parameters, data))}`
		return new WebSocket(url)
	}

const GetRequestByServer = (socketPath, serverServiceStatusReport) => (serverName, apiName) => {
	const {listServices=[], port} = 
	serverServiceStatusReport
	.find(({name}) => name === serverName) || {}

	//TODO Hard code
	const {path:servicePath, apiTemplate} = listServices
	.find(({serviceName}) => serviceName === apiName + "Controller") || {}

	return apiTemplate?.endpoints.reduce((acc, {method, path, parameters, summary}) =>
	 ({
		 ...acc, 
		 [summary] : 
			 method.toUpperCase() !== "WS"
			 ? GetRequest({ 
					socketPath,
					method,
					path: servicePath+path,
					parameters
				})
			: getSocket({
					socketPath, 
					path: servicePath+path, 
					parameters
				})
	  }), {})
}

module.exports = GetRequestByServer