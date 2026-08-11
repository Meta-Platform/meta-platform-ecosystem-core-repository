import axios from "axios"
import { HTTPServerManagerEndpoint, ServerAppName, IsElectronGui } from "./Environment"

// Lista de webservices em execução — o dado que o App.container de todo WebGui
// busca no boot e guarda em `list_web_servers_running` antes de liberar o
// render. Fora do Electron vem do Server Manager por HTTP; dentro do GUI-host
// não há HTTP, e a lista é SINTETIZADA no mesmo shape.
//
// O que variava de aplicativo para aplicativo era só a síntese:
//
//   "empty"     lista com um servidor e nenhum serviço — passa o portão de
//               render; quem fala por IPC não consulta o manifesto (my-desktop,
//               my-workspace, api-designer, datasource-manager)
//   "manifest"  lê window.metaGui.getManifest() e monta listServices com o
//               api.json de cada controller — necessário quando o
//               GetRequestByServer precisa distinguir WS de HTTP (control
//               panel, launcher, painel de instâncias, package-developer,
//               container-manager)
//   "none"      sem caminho IPC: o aplicativo só existe no navegador
//               (server-manager)

export type IPCServicesMode = "empty" | "manifest" | "none"

export type FetchWebServersRunningOptions = {
    ipcServices?: IPCServicesMode
    endpoint?: string
    serverName?: string
}

export const FetchWebServersRunning = async ({
    ipcServices = "empty",
    endpoint,
    serverName
}: FetchWebServersRunningOptions = {}): Promise<any[]> => {

    if(ipcServices !== "none" && IsElectronGui()){
        const name = serverName || ServerAppName()

        if(ipcServices === "empty")
            return [ { name, port: 0, listServices: [] } ]

        const manifest = await (window as any).metaGui.getManifest()
        const listServices = Object.keys(manifest || {}).map((apiName: string) => ({
            serviceName: `${apiName}Controller`,
            path: "",
            apiTemplate: manifest[apiName]
        }))
        return [ { name, port: 0, listServices } ]
    }

    const { data } = await axios.get(endpoint || HTTPServerManagerEndpoint())
    return data
}

export default FetchWebServersRunning
