
const path = require("path")
const os = require('os')
const fs = require("fs")

const ConvertPathToAbsolutPath = (_path) => path
    .join(_path)
    .replace('~', os.homedir())


const EcosystemDataHandlerService = (params) => {

    const {
        installDataDirPath,
        panelStateFilePath,
        onReady
    } = params

    const stateFilePath = panelStateFilePath
        ? ConvertPathToAbsolutPath(panelStateFilePath)
        : undefined

    // Lê o endereço do EcosystemData persistido (se houver), para o painel voltar
    // no endereço escolhido após reiniciar.
    const _ReadPersistedPath = () => {
        try {
            if(stateFilePath && fs.existsSync(stateFilePath)){
                const data = JSON.parse(fs.readFileSync(stateFilePath, "utf8"))
                if(data && data.ecosystemDataPath)
                    return data.ecosystemDataPath
            }
        } catch(e) {
            console.error(e)
        }
        return undefined
    }

    const _PersistPath = (newPath) => {
        if(!stateFilePath) return
        try {
            fs.mkdirSync(path.dirname(stateFilePath), { recursive: true })
            fs.writeFileSync(stateFilePath, JSON.stringify({ ecosystemDataPath: newPath }, null, 2))
        } catch(e) {
            console.error(e)
        }
    }

    let currentPath = _ReadPersistedPath() || installDataDirPath

    const _Start = () => onReady()

    _Start()

    return {
        GetEcosystemDataPath: () => ConvertPathToAbsolutPath(currentPath),
        SetEcosystemDataPath: (newPath) => {
            currentPath = newPath
            _PersistPath(newPath)
            return ConvertPathToAbsolutPath(currentPath)
        }
    }

}

module.exports = EcosystemDataHandlerService
