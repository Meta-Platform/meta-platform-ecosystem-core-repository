const RenderGeneralInformationTaskTable = require("../Utils/RenderGeneralInformationTaskTable")
const RenderStaticParametersTaskTable   = require("../Utils/RenderStaticParametersTaskTable")
const RenderLinkedParametersTaskTable   = require("../Utils/RenderLinkedParametersTaskTable")
const RenderAgentLinkRulesTaskTable     = require("../Utils/RenderAgentLinkRulesTaskTable")
const RenderActivationRulesTaskTable    = require("../Utils/RenderActivationRulesTaskTable")

const ShowTaskInformationCommand = async ({ args, startupParams, params}) => {

    const { taskId } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

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
        serverResourceEndpointPath: httpServerManagerEndpoint,
        mainApplicationSocketPath: platformApplicationSocketPath,
        CommandFunction
    })
}

module.exports = ShowTaskInformationCommand