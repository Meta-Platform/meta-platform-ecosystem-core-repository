const EnvironmentsController = (params) => {

    const {
        environmentHandlerService
    } = params

    return {
        controllerName : "EnvironmentsController",
        ListEnvironments: environmentHandlerService.ListEnvironments
    }
}

module.exports = EnvironmentsController