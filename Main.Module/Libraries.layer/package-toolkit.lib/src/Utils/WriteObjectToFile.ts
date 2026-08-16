const { 
    writeFile, 
} = require('node:fs/promises') as typeof import('node:fs/promises')

const WriteObjectToFile = async (filepath: string, objectContent: unknown) => {
    try{
        const data = new Uint8Array(Buffer.from( JSON.stringify(objectContent, null, '\t')))
        await writeFile(filepath, data)
    } catch(e){
        Log.error("WriteObjectToFile", `erro ao escrever arquivo ${filepath}!`)
        throw e
    }
}

module.exports = WriteObjectToFile