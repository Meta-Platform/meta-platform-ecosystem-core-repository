// Camada de transporte do kit. NÃO é interface: é o caminho pelo qual todo
// WebGui fala com o webservice que o serve — por HTTP/WebSocket no navegador e
// por IPC dentro do GUI-host do Electron.
//
// Estava copiada 11 vezes (1.331 linhas somadas) em `src/Utils/` de cada
// aplicativo. Atravessa área — o mesmo IPCWebSocket vivia no launcher, no
// painel de instâncias e no ecosystem-control-panel —, por isso mora no kit
// comum, e não numa biblioteca de área.
//
//   GetRequest             chama UM endpoint HTTP descrito pelo api.json
//   GetRequestByServer     resolve TODOS os endpoints de um webservice
//   GetRequestByIPC        mesma superfície, por window.metaGui.invoke
//   IPCWebSocket           WebSocket do browser sobre o canal IPC
//   GetAPI                 atalho para o webservice do próprio aplicativo
//   FetchWebServersRunning lista de webservices em execução (boot)

export { default as GetRequest, GetURL, GetParametersWithData } from "./GetRequest"
export type { RequestParameter } from "./GetRequest"
export { default as GetRequestByServer } from "./GetRequestByServer"
export type { GetRequestByServerOptions } from "./GetRequestByServer"
export { default as GetRequestByIPC } from "./GetRequestByIPC"
export type { GetRequestByIPCOptions } from "./GetRequestByIPC"
export { default as IPCWebSocket } from "./IPCWebSocket"
export { default as GetAPI } from "./GetAPI"
export type { GetAPIOptions } from "./GetAPI"
export { default as FetchWebServersRunning } from "./FetchWebServersRunning"
export type { FetchWebServersRunningOptions, IPCServicesMode } from "./FetchWebServersRunning"
export { ServerAppName, HTTPServerManagerEndpoint, IsElectronGui } from "./Environment"
