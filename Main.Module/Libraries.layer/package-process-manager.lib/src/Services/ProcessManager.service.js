const InitializeProcessManager = require("../InitializeProcessManager")

const ProcessManagerService = ({ runCommandPath, onReady }) => {
    const manager = InitializeProcessManager({ runCommandPath })
    onReady()
    return manager
}

module.exports = ProcessManagerService
