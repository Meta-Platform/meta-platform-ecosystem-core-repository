const path = require("path")

const ExtractInstalledRepositoriesByRepoData = (repositoriesData) => Object.keys(repositoriesData)

const ExtractInstalledAplicationByRepoData = (repositoriesData) => {
    const installedRepositoriesList = ExtractInstalledRepositoriesByRepoData(repositoriesData)

    const installedApplicationsList = installedRepositoriesList
        .reduce((acc, repositoryNamespace) => {

            const { installedApplications } = repositoriesData[repositoryNamespace]

            return [
                ...acc,
                ...installedApplications
                    .map((appData) => ({
                        repositoryNamespace,
                        ...appData
                    }))
            ]
        }, [])


    return installedApplicationsList
}

const ApplicationsAndPackagesController = (params) => {

    const { 
        ecosystemdataHandlerService,
        repositoryManagerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib 
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const _GetRepositoriesData = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        const repoDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA)
        const repositoriesData = await ReadJsonFile(repoDataFilePath)
        return repositoriesData
    }

    const ListApplications = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const installedApplicationsList = ExtractInstalledAplicationByRepoData(repositoriesData)
        return installedApplicationsList
    }

    return {
        controllerName : "ApplicationsAndPackagesController",
        ListPackages : repositoryManagerService.ListPackages,
        ListApplications
    }
}


module.exports = ApplicationsAndPackagesController