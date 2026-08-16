import type { MountedAPIs, ServerAPIs, ServerServiceStatusReport, ServiceStatus } from "./Types"

const FetchServerAndServiceStatus = require("./Communication/FetchServerAndServiceStatus") as (options: {
    serverResourceEndpointPath: string
    mainApplicationSocketPath: string
}) => Promise<ServerServiceStatusReport>

const GetRequestByServer = require("./Communication/GetRequestByServer") as (
    socketPath: string,
    serverServiceStatusReport: ServerServiceStatusReport
) => (serverName: string, apiName: string) => ServerAPIs | undefined

const GetServicesAPI = ({
    socketPath,
    serverName,
    listServices,
    serverServiceStatusReport
}: {
    socketPath: string
    serverName: string
    listServices: ServiceStatus[]
    serverServiceStatusReport: ServerServiceStatusReport
}): Record<string, ServerAPIs | undefined> => {
    return listServices.reduce((acc: Record<string, ServerAPIs | undefined>, {apiTemplate}) => {
        acc[apiTemplate.name] = GetRequestByServer(socketPath, serverServiceStatusReport)(serverName, apiTemplate.name)
        return acc
    }, {})
}

const MountAPIs = async ({
    serverResourceEndpointPath,
    mainApplicationSocketPath
}: {
    serverResourceEndpointPath: string
    mainApplicationSocketPath: string
}): Promise<MountedAPIs | undefined> => {

	const serverServiceStatusReport = await FetchServerAndServiceStatus({
        serverResourceEndpointPath,
        mainApplicationSocketPath
    })

	if(serverServiceStatusReport) {
		return serverServiceStatusReport
        .reduce((acc: MountedAPIs, { name, listServices }) => {
            acc[name] = GetServicesAPI({
                socketPath: mainApplicationSocketPath,
                serverName:name,
                listServices,
                serverServiceStatusReport
            })
            return acc
        }, {})
	}
	return undefined
}
module.exports = MountAPIs
