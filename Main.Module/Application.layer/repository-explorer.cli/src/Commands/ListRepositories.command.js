const MountAPIs = require("../Utils/MountAPIs")

const ListRepositoriesCommand = async ({ startupParams }) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams
    
	const APIs = await MountAPIs({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
    })
    const API = APIs
            .PlatformMainApplicationInstance
            .RepositoryManager
    const listRepositories = await API.ListRepositories()
    console.log("=========== Registered Repositories ===========")
    console.table(listRepositories)
    console.log("\n")
}
module.exports = ListRepositoriesCommand