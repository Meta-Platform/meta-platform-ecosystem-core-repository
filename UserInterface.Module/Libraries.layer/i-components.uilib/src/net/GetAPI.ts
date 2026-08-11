import GetRequestByServer, { GetRequestByServerOptions } from "./GetRequestByServer"
import { ServerAppName } from "./Environment"

// Atalho para o caso dominante: o aplicativo fala com o SEU próprio webservice,
// cujo nome vem do build (`process.env.SERVER_APP_NAME`).
//
// Os WebGui tinham duas formas disto. Uma sempre passava pelo
// GetRequestByServer (launcher, painel de instâncias, control panel); a outra
// desviava para o IPC antes de olhar o manifesto (my-desktop, MPM, api-designer)
// — que é exatamente `ipcMode: "proxy"`. As duas cabem no mesmo parâmetro.

export type GetAPIOptions = GetRequestByServerOptions & {
    // Nome do servidor no Server Manager. Por padrão, o do próprio aplicativo.
    serverName?: string
}

export const GetAPI = (
    { apiName, serverManagerInformation }: { apiName: string, serverManagerInformation: any },
    { serverName, ...options }: GetAPIOptions = {}
) =>
    GetRequestByServer(serverManagerInformation, options)(serverName || ServerAppName(), apiName)

export default GetAPI
