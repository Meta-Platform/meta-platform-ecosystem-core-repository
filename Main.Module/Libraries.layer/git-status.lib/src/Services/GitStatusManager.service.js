const InitializeGitStatusManager = require("../InitializeGitStatusManager")

// Serviço fino: instancia o gerenciador (watchers + cache) e o expõe. Sem
// parâmetros de startup — opera sobre caminhos passados pelo chamador.
const GitStatusManagerService = ({ onReady } = {}) => {
    const manager = InitializeGitStatusManager()
    onReady && onReady()
    return manager
}

module.exports = GitStatusManagerService
