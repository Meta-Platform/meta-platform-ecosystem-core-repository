import type { ApiCall, ApiParameter, ServerAPIs, ServerServiceStatusReport, ServiceStatus } from "../Types"

const SmartRequire = require("./SmartRequire") as (moduleName: string) => any

const WebSocket = SmartRequire('ws')

const GetRequest = require("./GetRequest") as (options: {
    socketPath: string
    method: string
    path: string
    parameters?: ApiParameter[]
}) => ApiCall

//TODO Ja existe repetido
const getURLPath = (path: string, parameters?: ApiParameter[]): string =>
parameters && parameters.length > 0
? parameters
    .filter((parameter) => (parameter.in == "path"))
    .reduce((path, parameter) => path.replace(`:${parameter.name}`, parameter.value), path)
: path

//TODO Ja existe repetido
const getParametersWithData = (parameters: ApiParameter[] | undefined, data: any) => {
    return parameters && parameters.map((parameter)=>{
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]

        return parameter
    })
}

const getSocket = ({socketPath, path, parameters}: {
    socketPath: string
    path: string
    parameters?: ApiParameter[]
}): ApiCall =>
	(data: any) => {
		const url = `ws+unix://${socketPath}:${getURLPath(path, getParametersWithData(parameters, data))}`
		return new WebSocket(url)
	}

const GetRequestByServer = (socketPath: string, serverServiceStatusReport: ServerServiceStatusReport) => (serverName: string, apiName: string): ServerAPIs | undefined => {
	const {listServices=[], port} =
	serverServiceStatusReport
	.find(({name}) => name === serverName) || {}

	//TODO Hard code
	const {path:servicePath, apiTemplate} = listServices
	.find(({serviceName}) => serviceName === apiName + "Controller") || {} as Partial<ServiceStatus>

	return apiTemplate?.endpoints.reduce((acc: ServerAPIs, {method, path, parameters, summary}) =>
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
