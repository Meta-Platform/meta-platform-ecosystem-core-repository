const fs = require('fs').promises

const CreateUtf8TextFile = async (filePath, content, loggerEmitter) => {
    try {
        await fs.writeFile(filePath, content, 'utf8')
        loggerEmitter && loggerEmitter.emit("log", {
            sourceName: "CreateUtf8TextFile",
            type: "info",
            message: `Arquivo criado com sucesso em: ${filePath}`
        })
    } catch (err) {
        console.error(err)
        loggerEmitter && loggerEmitter.emit("log", {
            sourceName: "CreateUtf8TextFile",
            type: "error",
            message: `Erro ao criar o arquivo em ${filePath}: ${err}`
        })
        throw err
    }
}

module.exports = CreateUtf8TextFile