// Fábrica: recebe runtimeDeps (injetadas pelo taskloader-registry) e devolve o
// StartControllerService — sem require relativo até o essential (permite este loader
// viver em outro repositório).
const CreateStartControllerService = (runtimeDeps) => {

    const { TaskStatusTypes, CommandChannelEventTypes } = runtimeDeps

    const StartControllerService = (loaderParams, executorChannel) => {
        const {
            serverService,
            url,
            nodejsPackageHandler,
            apiTemplate,
            controller,
            controllerParams,
            executionData,
            needsAuth
        } = loaderParams

        const apiTemplateData = nodejsPackageHandler.require(apiTemplate)
        const ControllerService = nodejsPackageHandler.require(controller)

        if(typeof ControllerService === "function"){
            serverService.AddServiceEndpoint({
                path: url,
                apiTemplate: apiTemplateData,
                service: ControllerService(controllerParams, executionData),
                needsAuth
            })
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
        } else {
            throw `\x1b[1;31m${controller}\x1b[0m controller is invalid`
        }
    }

    return StartControllerService
}

module.exports = CreateStartControllerService
