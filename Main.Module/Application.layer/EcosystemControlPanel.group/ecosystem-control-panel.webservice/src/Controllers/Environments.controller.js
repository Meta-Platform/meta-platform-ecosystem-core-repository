const EnvironmentsController = (params) => {

    const {
        ecosystemControlPanelService
    } = params

    return {
        controllerName : "EnvironmentsController",
        ListEnvironments: ecosystemControlPanelService.ListEnvironments
    }
}

module.exports = EnvironmentsController