const GetExecutableIconURL = ({ serverManagerInformation, executableName }:any) => {
    if(!executableName) return undefined

    // Electron GUI-host: ícone servido pelo protocolo custom metaicon://.
    if(typeof window !== "undefined" && (window as any).metaGui){
        const query = new URLSearchParams()
        query.set("executableName", executableName)
        return `metaicon://executable?${query.toString()}`
    }

    if(!serverManagerInformation) return undefined

    const server = (serverManagerInformation.list_web_servers_running || [])
        .find(({ name }:any) => name === process.env.SERVER_APP_NAME)
    const service = (server?.listServices || [])
        .find(({ serviceName }:any) => serviceName === "ExecutablesController")

    if(!server || !service) return undefined

    const port = Number(server.port) === 80 ? "" : `:${server.port}`
    return `http://localhost${port}${service.path}/executable-icon/${encodeURIComponent(executableName)}`
}

export default GetExecutableIconURL
