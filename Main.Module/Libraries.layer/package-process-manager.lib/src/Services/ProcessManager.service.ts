const InitializeProcessManager = require("../InitializeProcessManager") as (options: {
    runCommandPath?: string
    maxLogLines?: number
}) => any

const ProcessManagerService = ({ runCommandPath, onReady }: {
    runCommandPath?: string
    onReady: () => void
}) => {
    const manager = InitializeProcessManager({ runCommandPath })
    onReady()
    return manager
}

module.exports = ProcessManagerService
