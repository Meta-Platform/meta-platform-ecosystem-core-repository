// Serviço especializado em SERVIR A GUI (ecosystem-control-panel.webgui) da
// aplicação Electron SEM webservices HTTP (modo GUI-host — ver
// desktop-window-instance.lib). COMPÕE os 9 controllers já existentes do
// ecosystem-control-panel.webservice — zero duplicação de lógica; os .api.json
// são o manifesto (dual-transport com a webservice HTTP).
//
// Diferente dos apps mais simples, o control-panel tem endpoints WebSocket
// (LogStreaming, InstanceOverviewChange, RunPackageStreaming, StreamNotifications):
// além de Invoke (request/response), expõe InvokeStream, que recebe do host um
// objeto ws-like (wsShim, mesma API do `ws` do express-ws) e o entrega ao método
// WS do controller — espelhando o contrato do servidor HTTP.

const CONTROLLER_MODULES = {
    InstancesSupervisor:      { controller: "Controllers/InstancesSupervisor.controller",      api: "APIs/InstancesSupervisor.api.json" },
    ApplicationsAndPackages:  { controller: "Controllers/ApplicationsAndPackages.controller",  api: "APIs/ApplicationsAndPackages.api.json" },
    Executables:              { controller: "Controllers/Executables.controller",              api: "APIs/Executables.api.json" },
    Environments:             { controller: "Controllers/Environments.controller",             api: "APIs/Environments.api.json" },
    Sources:                  { controller: "Controllers/Sources.controller",                  api: "APIs/Sources.api.json" },
    Configurations:           { controller: "Controllers/Configurations.controller",           api: "APIs/Configurations.api.json" },
    HostActions:              { controller: "Controllers/HostActions.controller",              api: "APIs/HostActions.api.json" },
    EcosystemData:            { controller: "Controllers/EcosystemData.controller",            api: "APIs/EcosystemData.api.json" },
    Notification:             { controller: "Controllers/Notification.controller",             api: "APIs/Notification.api.json" }
}

// Endpoints de ícone (typeResponse:file) → servidos pelo protocolo metaicon://.
const ICON_MAP = {
    package:    { serviceName: "ApplicationsAndPackages", method: "GetPackageIcon" },
    executable: { serviceName: "Executables",             method: "GetExecutableIcon" }
}

const EcosystemControlPanelGuiService = (params) => {

    const {
        ecosystemdataHandlerService,
        notificationHubService,
        repositoryManagerService,
        instanceMonitoringManager,
        environmentHandlerService,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        ecosystemControlPanelWebservice,
        ecosystemDefaultsFileRelativePath,
        onReady
    } = params

    // Mesmo saco de parâmetros que o endpoint-group da webservice injeta nos
    // controllers (união de todos; chaves extras são ignoradas por cada um).
    const controllerParams = {
        ecosystemdataHandlerService,
        notificationHubService,
        repositoryManagerService,
        instanceMonitoringManager,
        environmentHandlerService,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        ecosystemDefaultsFileRelativePath
    }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = ecosystemControlPanelWebservice.require(controller)
        const apiTemplate        = ecosystemControlPanelWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)
        // O manifesto carrega o api.json inteiro (method/summary/parameters), para
        // o renderer reconstruir a MESMA superfície de API — inclusive saber quais
        // endpoints são WS (streaming) vs HTTP (invoke).
        manifest[apiName] = apiTemplate
        parametersBySummary[apiName] = (apiTemplate.endpoints || []).reduce((acc, { summary, parameters }) => {
            acc[summary] = parameters || []
            return acc
        }, {})
    })

    const _Parameters = (serviceName, method) => (parametersBySummary[serviceName] || {})[method] || []

    // Request/response. Espelha o contrato HTTP do server-manager:
    //   0 params → method(); 1 → method(valor); 2+ → method(objeto).
    const Invoke = async (serviceName, method, data) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Método desconhecido: ${serviceName}.${method}`)

        const parameters = _Parameters(serviceName, method)
        if(parameters.length === 0)  return controller[method]()
        if(parameters.length === 1)  return controller[method]((data || {})[parameters[0].name])
        return controller[method](data)
    }

    // Streaming (WebSocket). Espelha o contrato WS do server-manager:
    //   0 params → method(ws); 1 → method(ws, valor); 2+ → method(ws, objeto).
    // wsShim tem a mesma API do `ws` (send / on / close), fornecida pelo host.
    const InvokeStream = (serviceName, method, data, wsShim) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Stream desconhecido: ${serviceName}.${method}`)

        const parameters = _Parameters(serviceName, method)
        if(parameters.length === 0)  return controller[method](wsShim)
        if(parameters.length === 1)  return controller[method](wsShim, (data || {})[parameters[0].name])
        return controller[method](wsShim, data)
    }

    const GetManifest = () => manifest

    // Caminho de arquivo do ícone (usado pelo protocolo metaicon://). Reusa o
    // contrato de Invoke para respeitar o formato de args de cada endpoint.
    const GetIcon = ({ kind, args }) => {
        const target = ICON_MAP[kind] || ICON_MAP.package
        return Invoke(target.serviceName, target.method, args)
    }

    onReady && onReady()

    return {
        Invoke,
        InvokeStream,
        GetManifest,
        GetIcon
    }
}

module.exports = EcosystemControlPanelGuiService
