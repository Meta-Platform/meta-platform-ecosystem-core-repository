
const { resolve } = require("path")
const CommandExecutor = require("./CommandExecutor")

const ExecutePackage = (startupParams, path) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams

    const CommandFunction = async ({ APIs }) => {
        const API = APIs
        ?.PlatformMainApplicationInstance
        ?.EcosystemManager

        const absolutePath = resolve(process.cwd(), path)

        if(API){
            try{
                await API.RunPackage({
                    packagePath:absolutePath
                })
            }catch(e){
                console.error(e)
            }
            
        } else {
            throw "API não encontrada"
        }
    }

    CommandExecutor({
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
}

module.exports = ExecutePackage