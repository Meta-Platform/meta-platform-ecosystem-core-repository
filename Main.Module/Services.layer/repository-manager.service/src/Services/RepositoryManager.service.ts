const GetPackageIconPathByPackagePath = require("../Commons/GetPackageIconPathByPackagePath") as (packagePath: string) => Promise<string>
const path = require("path") as typeof import("path")
const os = require('os') as typeof import('os')
const { resolve } = require("path") as typeof import("path")

const ConvertPathToAbsolutPath = (_path: string): string => path
    .join(_path)
    .replace('~', os.homedir())

// O parâmetro do predicado se chamava `package` — palavra reservada em modo
// estrito, que é o modo de qualquer módulo TypeScript. Renomeado, mesma busca.
const FindPackage = (listPackages: any[], params: any) =>
    listPackages.find((candidate) => {
        return candidate.namespaceRepo === params.namespaceRepo
        && candidate.moduleName === params.moduleName
        && candidate.layerName === params.layerName
        && candidate.packageName === params.packageName
        && candidate.ext === params.ext
        && candidate.parentGroup === params.parentGroup
    })

const MountPackagePath = ({packageInfo, REPOS_CONF_EXT_GROUP_DIR}: { packageInfo: any, REPOS_CONF_EXT_GROUP_DIR: string }) => {
    const {
        layerPath,
        parentGroup,
        packageName,
        ext
    } = packageInfo

    const parentGroupChunkPath = parentGroup ? `${parentGroup}.${REPOS_CONF_EXT_GROUP_DIR}`:""
    const packageChunkPath = `${packageName}.${ext}`
    return resolve(layerPath, parentGroupChunkPath, packageChunkPath)
}

const GetPackageDependencyGraph = (metadataHierarchy: any) => {
    const { dependencyList, linkedGraph } = metadataHierarchy
    const { code } = dependencyList.find(({ dependency }: any) => !!dependency?.metadata?.boot) || {}
    if(code){
        const bootNode = linkedGraph[code]
        return {
            [code]: Object.keys(bootNode)
                .reduce((acc: any, dependencyCode: string) => ({ ...acc, [dependencyCode]:{}}), {})
        }
    }
}

const RepositoryManagerService = (params: any) => {

    const {
        installDataDirPath,
        REPOS_CONF_FILENAME_REPOS_DATA,
        REPOS_CONF_EXT_MODULE_DIR,
        REPOS_CONF_EXT_LAYER_DIR,
        REPOS_CONF_EXT_GROUP_DIR,
        REPOS_CONF_EXTLIST_PKG_TYPE,
        PKG_CONF_DIRNAME_METADATA,
        repositoryUtilitiesLib,
        dependencyGraphBuilderLib,
        onReady
    } = params

    const absolutInstallDataDirPath = ConvertPathToAbsolutPath(installDataDirPath)

    const ListPackages = async () => {
        const _ListPackages = repositoryUtilitiesLib.require("ListPackages")
        const packageList = await _ListPackages({
            installDataDirPath: absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR,
            REPOS_CONF_EXT_LAYER_DIR,
            REPOS_CONF_EXT_GROUP_DIR,
            REPOS_CONF_EXTLIST_PKG_TYPE
        })

        return packageList
    }

    const GetPackagePath = async(params: any) => {
        const packageList = await ListPackages()
    
        const packageInfo = FindPackage(packageList, params)
        if(packageInfo){
            const packagePath = MountPackagePath({packageInfo, REPOS_CONF_EXT_GROUP_DIR})
            return packagePath
        }
    }

    const GetPackageIconPath = async(params: any) => {
        const packagePath = await GetPackagePath(params)
    
        if(packagePath){
            return GetPackageIconPathByPackagePath(packagePath)
        }
    }
    
    const CheckPackageHasIcon = async (params: any) => {
        try{
            return !!await GetPackageIconPath(params)
        }catch(e){
            return false
        }
    }

    const GetMetadataHierarchy = async (params: any) => {
        const packagePath = await GetPackagePath(params)
        if(packagePath){
            const packageList = await ListPackages()
            const _BuildMetadataHierarchy = dependencyGraphBuilderLib.require("BuildMetadataHierarchy")
            const metadataHierarchy = await _BuildMetadataHierarchy({
                path: packagePath,
                packageList,
                REPOS_CONF_EXT_GROUP_DIR,
                PKG_CONF_DIRNAME_METADATA
            })

            return metadataHierarchy
        }
    }

    const GetPackageDependencyHierarchy = async (params: any) => {
        try{
            const metadataHierarchy = await GetMetadataHierarchy(params)
            if(metadataHierarchy){
                const packageDependencyGraph = GetPackageDependencyGraph(metadataHierarchy)
                return {
                    dependencyList: metadataHierarchy.dependencyList,
                    packageDependencyGraph
                }
            }
        } catch(e){
            return undefined
        }
        
    }

    const ListRepositories = () => {
        const _ListRepositories = repositoryUtilitiesLib.require("ListRepositories")
        const repositoryList = _ListRepositories({
            installDataDirPath: absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA,
        })

        return repositoryList
    }
    
    const ListModules = () => {
        const _ListModules = repositoryUtilitiesLib.require("ListModules")
        const moduleList = _ListModules({
            installDataDirPath: absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR
        })

        return moduleList
    }

    const ListLayers = () => {
        const _ListLayers = repositoryUtilitiesLib.require("ListLayers")
        const layerList = _ListLayers({
            installDataDirPath: absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR,
            REPOS_CONF_EXT_LAYER_DIR
        })

        return layerList
    }

    const _RegisterRepositoryInstallation = async ({ namespace, path }: { namespace: string, path: string }) => {
        const RegisterRepositoryInstallation = repositoryUtilitiesLib.require("RegisterRepositoryInstallation")
        await RegisterRepositoryInstallation({
            namespace, 
            path, 
            installDataDirPath: absolutInstallDataDirPath,
            REPOS_CONF_FILENAME_REPOS_DATA
        })
        return {}
    }

    onReady()

    return {
        ListRepositories,
        ListModules,
        ListLayers,
        RegisterRepositoryInstallation: _RegisterRepositoryInstallation,
        ListPackages,
        GetPackageIconPath,
        CheckPackageHasIcon,
        GetPackagePath,
        GetMetadataHierarchy,
        GetPackageDependencyHierarchy
    }
}

module.exports = RepositoryManagerService