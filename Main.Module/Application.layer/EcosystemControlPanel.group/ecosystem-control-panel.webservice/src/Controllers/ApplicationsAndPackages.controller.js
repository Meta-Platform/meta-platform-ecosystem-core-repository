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

const BuildPackageDataFromNamespace = ({ repositoryNamespace, packageNamespace }) => {
    const chunks = (packageNamespace || "").split("/")
    const moduleName = (chunks[0] || "").replace(/\.Module$/, "")
    const layerName = (chunks[1] || "").replace(/\.layer$/, "")
    const groupChunk = chunks.length === 4 ? chunks[2] : undefined
    const packageChunk = chunks[chunks.length - 1] || ""
    const packageChunkParts = packageChunk.split(".")
    const ext = packageChunkParts.pop()

    return {
        namespaceRepo: repositoryNamespace,
        moduleName,
        layerName,
        ...(groupChunk ? { parentGroup: groupChunk.replace(/\.group$/, "") } : {}),
        packageName: packageChunkParts.join("."),
        ext
    }
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

    const ListPackages = async () => {
        const packageList = await repositoryManagerService.ListPackages()
        return Promise.all(packageList.map(async (packageData) => ({
            ...packageData,
            hasPackageIcon: await repositoryManagerService.CheckPackageHasIcon(packageData)
        })))
    }

    const ListApplications = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const installedApplicationsList = ExtractInstalledAplicationByRepoData(repositoriesData)
        return Promise.all(installedApplicationsList.map(async (applicationData) => {
            const packageData = BuildPackageDataFromNamespace(applicationData)
            return {
                ...applicationData,
                packageData: {
                    ...packageData,
                    hasPackageIcon: await repositoryManagerService.CheckPackageHasIcon(packageData)
                }
            }
        }))
    }

    const GetPackageIcon = (params) => repositoryManagerService.GetPackageIconPath(params)

    return {
        controllerName : "ApplicationsAndPackagesController",
        ListPackages,
        ListApplications,
        GetPackageIcon
    }
}


module.exports = ApplicationsAndPackagesController
