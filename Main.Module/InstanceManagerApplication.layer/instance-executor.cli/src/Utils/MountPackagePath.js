
const { resolve } = require("path")

const MountPackagePath = (REPOS_CONF_EXT_GROUP_DIR, packageInfo) => {
    const {
        layerPath,
        parentGroup,
        packageName,
        ext
    } = packageInfo

    const parentGroupChunkPath = parentGroup ? `${parentGroup}.${REPOS_CONF_EXT_GROUP_DIR}`:""
    const packageChunkPath = `${packageName}.${ext}`
    return resolve(layerPath, parentGroupChunkPath, packageChunkPath)
}

module.exports = MountPackagePath