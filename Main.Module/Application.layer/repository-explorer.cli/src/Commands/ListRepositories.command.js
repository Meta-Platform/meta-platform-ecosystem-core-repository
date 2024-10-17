const MountAPIs = require("../Utils/MountAPIs")

const ListRepositoriesCommand = async () => {

	const APIs = await MountAPIs()
    const API = APIs
            .PlatformMainApplicationInstance
            .RepositoryManager
    const listRepositories = await API.ListRepositories()
    console.log("=========== Registered Repositories ===========")
    console.table(listRepositories)
    console.log("\n")
}
module.exports = ListRepositoriesCommand