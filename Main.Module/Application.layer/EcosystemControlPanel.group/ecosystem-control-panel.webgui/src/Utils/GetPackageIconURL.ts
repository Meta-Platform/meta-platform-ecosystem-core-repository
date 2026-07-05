const GetPackageIconURL = ({ serverManagerInformation, packageData }:any) => {
    if(!packageData || !packageData.hasPackageIcon) return undefined

    const query = new URLSearchParams()
    ;["namespaceRepo", "moduleName", "layerName", "packageName", "ext", "parentGroup"].forEach((key) => {
        if(packageData[key]) query.set(key, packageData[key])
    })

    // Electron GUI-host: ícone servido pelo protocolo custom metaicon://.
    if(typeof window !== "undefined" && (window as any).metaGui){
        return `metaicon://package?${query.toString()}`
    }

    if(!serverManagerInformation) return undefined

    const server = (serverManagerInformation.list_web_servers_running || [])
        .find(({ name }:any) => name === process.env.SERVER_APP_NAME)
    const service = (server?.listServices || [])
        .find(({ serviceName }:any) => serviceName === "ApplicationsAndPackagesController")

    if(!server || !service) return undefined

    const port = Number(server.port) === 80 ? "" : `:${server.port}`
    return `http://localhost${port}${service.path}/package-icon?${query.toString()}`
}

export default GetPackageIconURL
