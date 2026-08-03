/*
    Persistência dos perfis de conexão com runtimes de container (CTMG-9).

    Um arquivo JSON, não um banco: o que se guarda aqui é uma lista curta de
    endereços — nome, tipo e endpoint. Banco embutido custaria dependência,
    migração e processo para guardar o que cabe numa página.

    Duas decisões que valem por si:

    1. O caminho recebido é usado COMO VEIO. Nada de `path.resolve` por cima de
       caminho absoluto declarado: isso muda silenciosamente o arquivo lido
       quando o processo roda de outro diretório, e o sintoma aparece longe
       daqui, como "minhas conexões sumiram".

    2. A escrita é ATÔMICA (arquivo temporário + rename). Um desligamento no
       meio de um write deixaria um JSON truncado — e um JSON truncado é
       exatamente o mesmo que perder todas as conexões cadastradas.
*/

const { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } = require("node:fs")
const { dirname, join } = require("node:path")

const NOME_DO_ARQUIVO = "container-connections.json"
const SCHEMA_VERSION = 1

const ContainerConnectionStore = (params = {}) => {

    const { filePath, storageDir } = params

    if (!filePath && !storageDir) {
        throw new Error("ContainerConnectionStore exige filePath ou storageDir")
    }

    const caminho = filePath || join(storageDir, NOME_DO_ARQUIVO)

    const GarantirDiretorio = () => {
        const diretorio = dirname(caminho)
        if (!existsSync(diretorio)) {
            mkdirSync(diretorio, { recursive: true })
        }
    }

    /*
        Arquivo ausente é estado inicial legítimo (ninguém cadastrou nada
        ainda). Arquivo ilegível é outra história: devolver lista vazia faria a
        próxima gravação apagar o que estava lá. Por isso o erro sobe.
    */
    const Load = () => {
        if (!existsSync(caminho)) return []

        const conteudo = readFileSync(caminho, "utf8")
        if (conteudo.trim() === "") return []

        let dados
        try {
            dados = JSON.parse(conteudo)
        } catch (error) {
            throw new Error(`Arquivo de conexões ilegível em ${caminho}: ${error.message}`)
        }

        const conexoes = Array.isArray(dados) ? dados : dados.connections
        return Array.isArray(conexoes) ? conexoes : []
    }

    const Save = (connections) => {
        GarantirDiretorio()
        const documento = {
            schemaVersion: SCHEMA_VERSION,
            connections: Array.isArray(connections) ? connections : []
        }
        const temporario = `${caminho}.tmp`
        writeFileSync(temporario, `${JSON.stringify(documento, null, 4)}\n`, "utf8")
        renameSync(temporario, caminho)
        return documento.connections
    }

    const GetFilePath = () => caminho

    return Object.freeze({
        Load,
        Save,
        GetFilePath
    })
}

module.exports = ContainerConnectionStore
module.exports.NOME_DO_ARQUIVO = NOME_DO_ARQUIVO
module.exports.SCHEMA_VERSION = SCHEMA_VERSION
