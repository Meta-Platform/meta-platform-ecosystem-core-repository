const path = require('path')

const SmartRequire = (moduleName) => {
    const basePath = process.env.EXTERNAL_NODE_MODULES_PATH || 'node_modules'
    const modulePath = path.join(basePath, moduleName)
    return require(modulePath)
}

module.exports = SmartRequire