const express  = require("express")

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

const APIEndpointsService = ({path, service, apiTemplate}) => {

    const summariesNotFound = []

    const router = express.Router()

    const Start = () => {
        apiTemplate
        .endpoints
        .forEach((endpoint) => AttachEndpoint(endpoint))
    }

    const AttachEndpoint = ({
        typeResponse, 
        path, 
        method, 
        summary, 
        parameters
    }) => {

        const _Callback = async (request, response, next)=>{
            const params = getAllParams(request)

            try{
                if(!parameters){
                    await Send(typeResponse, response, service[summary]())
                }else if(Object.keys(params).length == 1 && parameters.length == 1){
                    await Send(typeResponse, response, service[summary](params[Object.keys(params)[0]]))
                }else{
                    await Send(typeResponse, response, service[summary](params))
                }
            }catch(e){
                next(e)
            }
            
        }

        const _CallbackWebSocket = (ws, request) => {

            const params = getAllParams(request)
            
            if(!parameters){
                service[summary](ws)
            }else if(Object.keys(params).length == 1 && parameters.length == 1){
                service[summary](ws, params[Object.keys(params)[0]])
            }else{
                service[summary](ws, params)
            }
        }

        if(method.toLowerCase() === "ws"){
            router[method.toLowerCase()](path, _CallbackWebSocket) 
        }else{
            router[method.toLowerCase()](path, _Callback) 
        }

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

module.exports = APIEndpointsService