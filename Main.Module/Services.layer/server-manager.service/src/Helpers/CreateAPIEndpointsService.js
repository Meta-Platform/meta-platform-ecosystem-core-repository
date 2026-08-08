const express  = require("express")

const BuildErrorResponse = require("./BuildErrorResponse")

const getAllParams = ({body, params:path, query}) => ({...path, ...body, ...query})

const Send = async (typeResponse, response, data) => {
    if(data instanceof Promise){
        const dataResolved = await data
        try{
            if(typeResponse === "file") {
                response.sendFile(dataResolved)
            }else if(typeof dataResolved === "number"){
                response.send(dataResolved.toString())
            } else response.send(dataResolved)
            
        }catch(e){
            response.status(500).send(e)
        }
    } else if(data && typeResponse === "file") {
        response.sendFile(data)
    } else response.send(data)
}

const CreateAPIEndpointsService = ({
    path,
    service,
    apiTemplate,
    needsAuth,
    middlewareService
}) => {

    const summariesNotFound = []

    const router = express.Router()

    /*
        ERRO DE CONTROLLER VIRA JSON, NÃO PÁGINA DE STACK.

        Erros de contrato deste ecossistema já carregam `code` + `httpStatus`/
        `statusCode` (ContractError, ContainerRuntimeUnavailableError,
        PlatformManagerUnavailableError, DelegatedCredentialsError...); a
        tradução para status e corpo está em BuildErrorResponse.js, onde é
        verificável sem subir servidor.
    */
    const _ErrorResponseMiddleware = (error, request, response, next) => {
        if (response.headersSent) return next(error)
        const { status, body } = BuildErrorResponse(error)
        response.status(status).json(body)
    }

    const Start = () => {
        apiTemplate
        .endpoints
        .forEach((endpoint) => AttachEndpoint(endpoint))

        // Depois de TODAS as rotas: o Express só procura tratadores de erro
        // adiante na pilha, então registrar antes não capturaria nada.
        router.use(_ErrorResponseMiddleware)
    }

    const AttachEndpoint = ({
        typeResponse, 
        path, 
        method, 
        summary, 
        forwardRawRequest,
        parameters
    }) => {

        const _CallbackMiddleware = async (request, response, next) => {
            const params = getAllParams(request)

            try{
                if(service[summary]){

                    const { authenticationData } = request

                    if(!parameters){
                        await Send(typeResponse, response, service[summary](authenticationData ? { authenticationData } : undefined))
                    }else if(Object.keys(params).length == 1 && parameters.length == 1){
                        await Send(typeResponse, response, service[summary](params[Object.keys(params)[0]], authenticationData ? { authenticationData } : undefined))
                    }else{
                        await Send(typeResponse, response, service[summary](params, authenticationData ? { authenticationData } : undefined))
                    }
                    
                } else {
                    throw `O summary "${summary}" do controller "${service.controllerName}" está indefinido!`
                }
            }catch(e){
                next(e)
            }
            
        }

        const _CallbackWebSocketMiddleware = (ws, request) => {
            
            const params = getAllParams(request)

            const { authenticationData } = request
            
            if(!parameters){
                service[summary](ws, authenticationData ? { authenticationData } : undefined)
            }else if(Object.keys(params).length == 1 && parameters.length == 1){
                service[summary](ws, params[Object.keys(params)[0]], authenticationData ? { authenticationData } : undefined)
            }else{
                service[summary](ws, params, authenticationData ? { authenticationData } : undefined)
            }
        }

        
        const _ForwardRaweRequestMiddleware = async (request, response, next) => {
            try{
                if(service[summary]){
                    service[summary](request, response, next)
                } else {
                    throw `O summary "${summary}" do controller "${service.controllerName}" está indefinido!`
                }
            }catch(e){
                next(e)
            }
        }

        const _GetCallbackMiddlewareFunction = () => 
            forwardRawRequest
            ? _ForwardRaweRequestMiddleware
            : method.toLowerCase() === "ws"
                ? _CallbackWebSocketMiddleware
                : _CallbackMiddleware
        
        
        if(needsAuth === true)
            if(method.toLowerCase() === "ws")
                router[method.toLowerCase()](path, middlewareService.GetWebSocketMiddleware(), _GetCallbackMiddlewareFunction()) 
            else
                router[method.toLowerCase()](path, middlewareService.GetMiddleware(), _GetCallbackMiddlewareFunction()) 
        else
            router[method.toLowerCase()](path, _GetCallbackMiddlewareFunction())


        if(!service[summary])
            summariesNotFound.push(summary)

    }
    
    Start()

    return {
        GetData: () => {
            return {
                serviceName: "APIEndpointsService", 
                path, 
                service, 
                apiTemplate, 
                summariesNotFound
            }
        },
        GetRoute: () => router
    }
}

module.exports = CreateAPIEndpointsService