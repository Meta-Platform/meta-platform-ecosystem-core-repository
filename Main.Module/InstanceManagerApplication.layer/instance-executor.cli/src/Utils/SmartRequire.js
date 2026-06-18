const path = require('path')

const SmartRequire = (moduleName) => {
    try{
        const basePath = process.env.EXTERNAL_NODE_MODULES_PATH || 'node_modules'
        const modulePath = path.join(basePath, moduleName)
        return require(modulePath)
    }catch(e){
        console.error(`Erro ao tentar carregar o ${moduleName}`)
        throw e
    }
    
}

module.exports = SmartRequire