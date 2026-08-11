// Transporte IPC (aplicações Electron GUI-host): no lugar de HTTP/webservices,
// o renderer chama os services hospedados no processo principal do Electron por
// window.metaGui.invoke(serviceName, method, args). Espelha a superfície do
// GetRequestByServer (HTTP): devolve um objeto cujos métodos, ao serem
// chamados, disparam o invoke e embrulham o retorno em { data } — compatível
// com o shape de resposta do axios que os containers já leem.
//
// Usa Proxy para não precisar enumerar métodos: qualquer acesso a
// api.NomeDoMetodo(args) vira invoke(apiName, "NomeDoMetodo", args).

// O Electron embrulha qualquer erro lançado em ipcMain.handle com o prefixo
// técnico "Error invoking remote method '<canal>': ". Removemos esse ruído para
// que o usuário veja apenas a mensagem de negócio lançada pelo controller.
const CleanIpcError = (error: any) => {
    const raw = typeof error === "string" ? error : (error?.message || "")
    const message = raw.replace(/^Error invoking remote method '[^']*':\s*/, "")
    return new Error(message || "Falha na comunicação com o processo principal.")
}

export type GetRequestByIPCOptions = {
    // Limpa o prefixo técnico do Electron da mensagem de erro. Ligado por
    // padrão: das cinco cópias que existiam, só a do my-desktop já fazia isso,
    // e a mensagem crua nunca é o que se quer mostrar.
    cleanErrors?: boolean
}

export const GetRequestByIPC = (apiName: string, { cleanErrors = true }: GetRequestByIPCOptions = {}) =>
    new Proxy({} as any, {
        get: (_target, method: string) =>
            (data?: object) => {
                const call = (window as any).metaGui
                    .invoke(apiName, method, data)
                    .then((result: any) => ({ data: result }))

                return cleanErrors
                    ? call.catch((error: any) => { throw CleanIpcError(error) })
                    : call
            }
    })

export default GetRequestByIPC
