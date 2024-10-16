const CommandExecutor = require("../Utils/CommandExecutor")

const RenderGeneralInformationTaskTable = require("../Utils/RenderGeneralInformationTaskTable")
const RenderStaticParametersTaskTable   = require("../Utils/RenderStaticParametersTaskTable")
const RenderLinkedParametersTaskTable   = require("../Utils/RenderLinkedParametersTaskTable")
const RenderAgentLinkRulesTaskTable     = require("../Utils/RenderAgentLinkRulesTaskTable")
const RenderActivationRulesTaskTable    = require("../Utils/RenderActivationRulesTaskTable")

const ShowTaskInformationCommand = async ({ args:{ taskId }, startupParams}) => {

    const {
        PLATFORM_APPLICATION_SOCKET_PATH,
        HTTP_SERVER_MANAGER_ENDPOINT
    } = startupParams


    const CommandFunction = async ({ APIs }) => {
        const API = APIs
            .PlatformMainApplicationInstance
            .TaskExecutorMachine

        try{
            const task = await API.GetTask({taskId})
            await RenderGeneralInformationTaskTable(task)
            await RenderStaticParametersTaskTable(task.staticParameters)

            task.linkedParameters
                && await RenderLinkedParametersTaskTable(task.linkedParameters)

            task.agentLinkRules
                && await RenderAgentLinkRulesTaskTable(task.agentLinkRules)

            task.activationRules 
                && await RenderActivationRulesTaskTable(task.activationRules)

        } catch(e){
            console.log(e)
        }
    }
    
    await CommandExecutor({
        serverResourceEndpointPath: HTTP_SERVER_MANAGER_ENDPOINT,
        mainApplicationSocketPath: PLATFORM_APPLICATION_SOCKET_PATH,
        CommandFunction
    })
}

module.exports = ShowTaskInformationCommand