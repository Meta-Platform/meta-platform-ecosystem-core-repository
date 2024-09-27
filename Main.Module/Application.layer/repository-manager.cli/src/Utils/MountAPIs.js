const FetchServerAndServiceStatus = require("./Communication/FetchServerAndServiceStatus")
const GetRequestByServer = require("./Communication/GetRequestByServer")

const GetServicesAPI = ({
    socketPath,
    serverName,
    listServices,
    serverServiceStatusReport
}) => {
    return listServices.reduce((acc, {apiTemplate}) => {
        acc[apiTemplate.name] = GetRequestByServer(socketPath, serverServiceStatusReport)(serverName, apiTemplate.name)
        return acc
    }, {})
}

const MountAPIs = async ({
    serverResourceEndpointPath,
    mainApplicationSocketPath
}) => {

	const serverServiceStatusReport = await FetchServerAndServiceStatus({
        serverResourceEndpointPath,
        mainApplicationSocketPath
    })
    
	if(serverServiceStatusReport) {
		return serverServiceStatusReport
        .reduce((acc, { name, listServices }) => {
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