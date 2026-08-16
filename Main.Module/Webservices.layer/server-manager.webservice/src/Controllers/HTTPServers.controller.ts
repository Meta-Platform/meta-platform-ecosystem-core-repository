const GetJSONAPI = ({
    serviceName, 
    path, 
    service, 
    apiTemplate, 
    summariesNotFound
}: any) => {
    
    return {
        type:serviceName, 
        serviceName: service.controllerName || serviceName, 
        path, 
        apiTemplate, 
        summariesNotFound
    }
}

const GetJSONStaticEndpoints = ({
    serviceName, 
    path, 
    staticDir
}: any) => {
    return {
        type:serviceName, 
        path, 
        staticDir
    }
} 

const HTTPServersController = (params: any) => {
    const { httpServerService } = params

    const _Status = () => {
        return [
            {
                name: httpServerService.GetName(),
                port: httpServerService.GetPort(),
                //TODO trocar property listServices para serviceList
                listServices: httpServerService.ListServices()
                .map((service: any) => {
                    const serviceData = service.GetData()
                    switch(serviceData.serviceName){
                        case "APIEndpointsService":
                            return GetJSONAPI(serviceData)
                        case "StaticEndpointsService":
                            return GetJSONStaticEndpoints(serviceData)
                        default:
                            return {}
                    }
                })
            }
        ]
    }

    const controllerServiceObject = {
        controllerName : "HTTPServersController",
        Status         : _Status
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = HTTPServersController