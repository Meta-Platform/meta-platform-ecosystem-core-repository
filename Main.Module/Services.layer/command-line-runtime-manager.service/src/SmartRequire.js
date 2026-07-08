const path = require("path")

// require resiliente a partir do diretório de dependências externas do
// ecossistema (mesmo padrão de mount-api.lib / command-executor.lib).
const SmartRequire = (moduleName) => {
    try {
        const basePath = process.env.EXTERNAL_NODE_MODULES_PATH || "node_modules"
        const modulePath = path.join(basePath, moduleName)
        return require(modulePath)
    } catch(error) {
        console.error(`Erro ao tentar carregar o ${moduleName}`)
        throw error
    }
}

module.exports = SmartRequire
