const GetIsolateExecutionParameters = (executionParams: any, executionData: any) => {

    const ScanChildren = (executionParam: any) => executionParam.children
        ? {children: ScanExecutionParams(executionParam.children)}
        : {}


    const AddExecutionDataToStaticParameters = (executionParam: any) => {
        return {
            staticParameters:{
                ...executionParam.staticParameters || {},
                executionData
            },
        }
    }

    const AddExecutionDataToRequeriment = (requeriment: any) => {
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

    const AddExecutionDataToActivationRules = (executionParam: any) => {
        return executionParam.activationRules
        ? {
            activationRules: {
                ...executionParam.activationRules,
                ...AddExecutionDataToRequeriment(executionParam.activationRules),
            }
        }
        : {}
    }

    const AddExecutionDataToAgentLinkRules = (executionParam: any) => {
        return executionParam.agentLinkRules
        ? {
            agentLinkRules: executionParam
                .agentLinkRules
                .map(({referenceName, requirement}: any) => {
                    return {
                        referenceName,
                        requirement: AddExecutionDataToRequeriment(requirement)
                    }
                })
        }
        : {} 
    }

    const ScanExecutionParams = (executionParams: any) =>
        executionParams.map((executionParam: any) => {
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