const ShowTaskInformationCommand = async ({ args, startupParams, params}) => {

    const { taskId } = args

    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    const { commandExecutorLib, taskTableRenderLib } = params
    
    const CommandExecutor = commandExecutorLib.require("CommandExecutor")

    const RenderGeneralInformationTaskTable = taskTableRenderLib.require("RenderGeneralInformationTaskTable")
    const RenderStaticParametersTaskTable = taskTableRenderLib.require("RenderStaticParametersTaskTable")
    const RenderLinkedParametersTaskTable = taskTableRenderLib.require("RenderLinkedParametersTaskTable")
    const RenderAgentLinkRulesTaskTable = taskTableRenderLib.require("RenderAgentLinkRulesTaskTable")
    const RenderActivationRulesTaskTable = taskTableRenderLib.require("RenderActivationRulesTaskTable")

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