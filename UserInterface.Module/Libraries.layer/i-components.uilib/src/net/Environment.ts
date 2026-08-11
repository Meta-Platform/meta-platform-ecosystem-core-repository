// Valores injetados pelo DefinePlugin do web-interface-builder no build de cada
// WebGui (ver CreateWebpackConfig): não existe `process` em tempo de execução no
// navegador — a EXPRESSÃO `process.env.X` é substituída por um literal durante o
// build. Por isso ela aparece aqui escrita por extenso, sem guarda `typeof`:
// qualquer outra forma sobreviveria ao build e explodiria com ReferenceError.
declare const process: { env: { [key: string]: string | undefined } }

// Nome do webservice que serve este aplicativo (parâmetro `serverAppName`).
export const ServerAppName = (): string => process.env.SERVER_APP_NAME as string

// Endereço do Server Manager, de onde sai a lista de webservices em execução.
export const HTTPServerManagerEndpoint = (): string => process.env.HTTP_SERVER_MANAGER_ENDPOINT as string

// O renderer roda dentro do GUI-host do Electron? Nesse modo não há HTTP: os
// services são hospedados no processo principal e falam por IPC.
export const IsElectronGui = (): boolean =>
    typeof window !== "undefined" && Boolean((window as any).metaGui)
