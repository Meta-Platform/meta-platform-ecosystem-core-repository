const GetPackageIconPathByPackagePath = require("../Commons/GetPackageIconPathByPackagePath")

const { resolve } = require("path")

const FindPackage = (listPackages, params) => 
    listPackages.find((package) => {
        return package.namespaceRepo === params.namespaceRepo 
        && package.moduleName === params.moduleName
        && package.layerName === params.layerName
        && package.packageName === params.packageName
        && package.ext === params.ext
        && package.parentGroup === params.parentGroup
    })

const MountPackagePath = ({packageInfo, REPOS_CONF_EXT_GROUP_DIR}) => {
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

const GetPackageDependencyGraph = (metadataHierarchy) => {
    const { dependencyList, linkedGraph } = metadataHierarchy
    const { code } = dependencyList.find(({ dependency }) => !!dependency?.metadata?.boot) || {}
    if(code){
        const bootNode = linkedGraph[code]
        return {
            [code]: Object.keys(bootNode)
                .reduce((acc, dependencyCode) => ({ ...acc, [dependencyCode]:{}}), {})
        }
    }
}

const RepositoryManagerService = (params) => {

    const {
        ECO_DIRPATH_INSTALL_DATA,
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

    const ListPackages = async () => {
        const _ListPackages = repositoryUtilitiesLib.require("ListPackages")
        const packageList = await _ListPackages({
            ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR,
            REPOS_CONF_EXT_LAYER_DIR,
            REPOS_CONF_EXT_GROUP_DIR,
            REPOS_CONF_EXTLIST_PKG_TYPE
        })

        return packageList
    }

    const GetPackagePath = async(params) => {
        const packageList = await ListPackages()
    
        const packageInfo = FindPackage(packageList, params)
        if(packageInfo){
            const packagePath = MountPackagePath({packageInfo, REPOS_CONF_EXT_GROUP_DIR})
            return packagePath
        }
    }

    const GetPackageIconPath = async(params) => {
        const packagePath = await GetPackagePath(params)
    
        if(packagePath){
            return GetPackageIconPathByPackagePath(packagePath)
        }
    }
    
    const CheckPackageHasIcon = async (params) => {
        try{
            return !!await GetPackageIconPath(params)
        }catch(e){
            return false
        }
    }

    const GetMetadataHierarchy = async (params) => {
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

    const GetPackageDependencyHierarchy = async (params) => {
        const metadataHierarchy = await GetMetadataHierarchy(params)
        if(metadataHierarchy){
            const packageDependencyGraph = GetPackageDependencyGraph(metadataHierarchy)
            return {
                dependencyList: metadataHierarchy.dependencyList,
                packageDependencyGraph
            }
        }
    }

    const ListRepositories = () => {
        const _ListRepositories = repositoryUtilitiesLib.require("ListRepositories")
        const repositoryList = _ListRepositories({
            ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA,
        })

        return repositoryList
    }
    
    const ListModules = () => {
        const _ListModules = repositoryUtilitiesLib.require("ListModules")
        const moduleList = _ListModules({
            ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR
        })

        return moduleList
    }

    const ListLayers = () => {
        const _ListLayers = repositoryUtilitiesLib.require("ListLayers")
        const layerList = _ListLayers({
            ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA,
            REPOS_CONF_EXT_MODULE_DIR,
            REPOS_CONF_EXT_LAYER_DIR
        })

        return layerList
    }

    const RegisterRepository = async ({ namespace, path }) => {
        const _RegisterRepository = repositoryUtilitiesLib.require("RegisterRepository")
        await _RegisterRepository({
            namespace, 
            path, 
            ECO_DIRPATH_INSTALL_DATA,
            REPOS_CONF_FILENAME_REPOS_DATA
        })
        return {}
    }

    onReady()

    return {
        ListRepositories,
        ListModules,
        ListLayers,
        RegisterRepository,
        ListPackages,
        GetPackageIconPath,
        CheckPackageHasIcon,
        GetPackagePath,
        GetMetadataHierarchy,
        GetPackageDependencyHierarchy
    }
}

module.exports = RepositoryManagerService