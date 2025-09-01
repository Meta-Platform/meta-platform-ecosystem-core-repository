const { 
    writeFile, 
} = require('node:fs/promises')

const WriteObjectToFile = async (filepath, objectContent) => {
    try{
        const data = new Uint8Array(Buffer.from( JSON.stringify(objectContent, null, '\t')))
        await writeFile(filepath, data)
    } catch(e){
        console.log(`erro ao escrever arquivo ${filepath}!`)
        throw e
    }
}

module.exports = WriteObjectToFile