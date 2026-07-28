
const { resolve } = require("path")
const CommandExecutor = require("../../../../Libraries.layer/command-executor.lib/src/CommandExecutor")

const ExecutePackage = async (startupParams, path) => {

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
                Log.error("ExecutePackage", e)
            }
            
        } else {
            throw "API não encontrada"
        }
    }

    await CommandExecutor({
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ExecutePackage