const ListRepositoriesCommand = async ({ startupParams, params }) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { mountApiLib } = params
    
    const MountAPIs = mountApiLib.require("MountAPIs")
    
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