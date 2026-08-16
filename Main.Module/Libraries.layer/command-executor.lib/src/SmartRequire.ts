const path = require('path') as typeof import('path')

const SmartRequire = (moduleName: string): any => {
    try{
        const basePath = process.env.EXTERNAL_NODE_MODULES_PATH || 'node_modules'
        const modulePath = path.join(basePath, moduleName)
        return require(modulePath)
    }catch(e){
        Log.error("SmartRequire", `Erro ao tentar carregar o ${moduleName}`)
        throw e
    }

}

module.exports = SmartRequire
