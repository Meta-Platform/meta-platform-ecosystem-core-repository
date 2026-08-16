const ListRepositoriesCommand = async ({ startupParams, params }: any) => {

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
    Log.message("ListRepositories", "=========== Registered Repositories ===========")
    console.table(listRepositories)
    Log.message("ListRepositories", "\n")
}
module.exports = ListRepositoriesCommand