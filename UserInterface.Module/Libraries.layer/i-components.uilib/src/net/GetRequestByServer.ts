import GetRequest from "./GetRequest"
import GetRequestByIPC from "./GetRequestByIPC"
import IPCWebSocket from "./IPCWebSocket"
import { IsElectronGui } from "./Environment"

// Resolve o cliente de UM webservice a partir do que o Server Manager publicou:
// para cada endpoint do api.json devolve a função que o chama, indexada pelo
// `summary`. HTTP vira GetRequest; WS vira `new WebSocket(...)`.
//
// Existiam CINCO variantes deste arquivo espalhadas pelos WebGui. Elas não
// divergiam por gosto — cada uma cobria um caso real —, então aqui todas viram
// opção, e o padrão é a variante mais comum (IPC por endpoint, sem query no WS,
// sem normalização de caminho):
//
//   ipc            liga o transporte IPC quando há window.metaGui
//   ipcMode        "endpoints" mapeia endpoint a endpoint pelo manifesto;
//                  "proxy" delega tudo ao GetRequestByIPC (dispensa manifesto)
//   wsQueryParams  leva os parâmetros in:"query" para a URL do WebSocket
//   normalizePath  colapsa "//" ao juntar caminho do serviço + do endpoint

export type GetRequestByServerOptions = {
    ipc?: boolean
    ipcMode?: "endpoints" | "proxy"
    wsQueryParams?: boolean
    normalizePath?: boolean
    cleanErrors?: boolean
}

const GetURLPath = (path: string, parameters: Array<object>, wsQueryParams: boolean) => {
    const withPath = parameters && parameters.length > 0
        ? parameters
            .filter((parameter: any) => (parameter.in == "path"))
            .reduce((path: string, parameter: any) => path.replace(`:${parameter.name}`, parameter.value), path)
        : path

    if(!wsQueryParams) return withPath

    // Sem isto o WebSocket nasce sem argumentos — foi o defeito que o
    // package-developer corrigiu no GitStatusStream (?repositories=...).
    const query = (parameters || [])
        .filter((parameter: any) => parameter.in == "query" && parameter.value !== undefined)
        .map((parameter: any) => `${encodeURIComponent(parameter.name)}=${encodeURIComponent(parameter.value)}`)
        .join("&")

    return query ? `${withPath}?${query}` : withPath
}

const GetParametersWithData = (parameters: Array<any>, data: any) =>
    parameters && parameters.map((parameter) => {
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]

        return parameter
    })

const GetSocket = (port: number, path: string, parameters: Array<Object>, wsQueryParams: boolean) =>
    (data: object) =>
        new WebSocket(`ws://localhost:${port === 80 ? "" : port}${GetURLPath(path, GetParametersWithData(parameters as any, data), wsQueryParams)}`)

export const GetRequestByServer = (
    { list_web_servers_running }: any,
    {
        ipc = true,
        ipcMode = "endpoints",
        wsQueryParams = false,
        normalizePath = false,
        cleanErrors = true
    }: GetRequestByServerOptions = {}
) => (serverName: string, name: string) => {

    // Electron GUI-host sem manifesto: todo método vira um invoke pelo nome.
    // serverName/list_web_servers_running são ignorados neste caminho.
    if(ipc && ipcMode === "proxy" && IsElectronGui())
        return GetRequestByIPC(name, { cleanErrors })

    const { listServices = [], port } =
        list_web_servers_running
        .find(({ name }: any) => name === serverName) || {}

    //TODO Hard code
    const { path: servicePath, apiTemplate } = listServices
        .find(({ serviceName }: any) => serviceName === name + "Controller") || {}

    // Electron GUI-host com manifesto: HTTP vira window.metaGui.invoke
    // (devolvendo { data }) e WS vira um IPCWebSocket (compatível com a API de
    // WebSocket do browser). O gui.service espelha o contrato de args do
    // servidor, então basta encaminhar `data`.
    const isIPC = ipc && IsElectronGui()

    const JoinPath = (path: string) =>
        normalizePath ? `${servicePath}${path}`.replace(/\/{2,}/g, "/") : servicePath + path

    return apiTemplate?.endpoints.reduce((acc: any, { method, path, parameters, summary }: any) =>
        ({
            ...acc,
            [summary]:
                isIPC
                    ? ( method.toUpperCase() !== "WS"
                        ? (data: object) => (window as any).metaGui.invoke(name, summary, data).then((result: any) => ({ data: result }))
                        : (data: object) => new IPCWebSocket(name, summary, data) )
                    : ( method.toUpperCase() !== "WS"
                        ? GetRequest(port, method, JoinPath(path), parameters)
                        : GetSocket(port, JoinPath(path), parameters, wsQueryParams) )
        }), {})
}

export default GetRequestByServer
