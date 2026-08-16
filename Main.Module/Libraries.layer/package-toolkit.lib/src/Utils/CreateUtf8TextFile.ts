const fs = (require('fs') as typeof import('fs')).promises

const CreateUtf8TextFile = async (filePath: string, content: string) => {
    try {
        await fs.writeFile(filePath, content, 'utf8')
        Log.info("CreateUtf8TextFile", `Arquivo criado com sucesso em: ${filePath}`)
    } catch (err) {
        Log.error("CreateUtf8TextFile", err)
        Log.error("CreateUtf8TextFile", `Erro ao criar o arquivo em ${filePath}: ${err}`)
        throw err
    }
}

module.exports = CreateUtf8TextFile