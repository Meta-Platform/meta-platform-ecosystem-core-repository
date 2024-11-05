
const { resolve } = require("path")
const CommandExecutor = require("./CommandExecutor")

const ExecutePackage = (startupParams, path) => {

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
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
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ExecutePackage