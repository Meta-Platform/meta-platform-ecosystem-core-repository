const GetExecutableIconURL = ({ serverManagerInformation, executableName }:any) => {
    if(!serverManagerInformation || !executableName) return undefined

    const server = (serverManagerInformation.list_web_servers_running || [])
        .find(({ name }:any) => name === process.env.SERVER_APP_NAME)
    const service = (server?.listServices || [])
        .find(({ serviceName }:any) => serviceName === "ExecutablesController")

    if(!server || !service) return undefined

    const port = Number(server.port) === 80 ? "" : `:${server.port}`
    return `http://localhost${port}${service.path}/executable-icon/${encodeURIComponent(executableName)}`
}

export default GetExecutableIconURL
