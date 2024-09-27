const GetIsolateExecutionParameters = (executionParams, executionData) => {

    const ScanChildren = (executionParam) => executionParam.children
        ? {children: ScanExecutionParams(executionParam.children)}
        : {}


    const AddExecutionDataToStaticParameters = (executionParam) => {
        return {
            staticParameters:{
                ...executionParam.staticParameters || {},
                executionData
            },
        }
    }

    const AddExecutionDataToRequeriment = (requeriment) => {
        return requeriment["&&"]
        ? {
            "&&": [
                ...requeriment["&&"],
                {
                    "property": "params.executionData.environmentPath",
                    "=": executionData.environmentPath
                }
            ]
        }
        : {}
    }

    const AddExecutionDataToActivationRules = (executionParam) => {
        return executionParam.activationRules
        ? {
            activationRules: {
                ...executionParam.activationRules,
                ...AddExecutionDataToRequeriment(executionParam.activationRules),
            }
        }
        : {}
    }

    const AddExecutionDataToAgentLinkRules = (executionParam) => {
        return executionParam.agentLinkRules
        ? {
            agentLinkRules: executionParam
                .agentLinkRules
                .map(({referenceName, requirement}) => {
                    return {
                        referenceName,
                        requirement: AddExecutionDataToRequeriment(requirement)
                    }
                })
        }
        : {} 
    }

    const ScanExecutionParams = (executionParams) =>
        executionParams.map((executionParam) => {
            return {
                ...executionParam,
                ...AddExecutionDataToStaticParameters(executionParam),
                ...AddExecutionDataToActivationRules(executionParam),
                ...AddExecutionDataToAgentLinkRules(executionParam),
                ...ScanChildren(executionParam)
            }
        })

    return ScanExecutionParams(executionParams)
}
module.exports = GetIsolateExecutionParameters