/*
    TAR mínimo, escrito à mão (VDRP-260).

    POR QUE NÃO USAR UMA BIBLIOTECA: a API do Docker troca arquivos com um
    container por TAR (`putArchive`/`getArchive`) — não há outro caminho. Mas
    este pacote tem UMA dependência declarada (dockerode) e depender de uma
    transitiva dela (tar-stream, tar-fs) é depender de algo que ninguém
    prometeu manter no lugar: uma atualização de dockerode pode trocar a
    implementação interna e derrubar isto sem aviso, longe daqui.

    O formato que precisamos é o subconjunto mais simples do USTAR: um cabeçalho
    de 512 bytes por arquivo, o conteúdo alinhado em blocos de 512, e dois
    blocos zerados no fim. São ~40 linhas, é estável desde 1988, e — o que mais
    importa — dá para testar TUDO isto sem Docker, sem rede e sem container.

    LIMITE DECLARADO: nomes de até 100 bytes (campo `name` do cabeçalho) e um
    arquivo por vez. Não implementamos prefixos longos (formato PAX/GNU) porque
    o nome que entra aqui é sempre o nome de um arquivo dentro de um espaço, já
    sanitizado por quem chama. Nome maior é RECUSADO explicitamente — nunca
    truncado em silêncio, que produziria um arquivo com nome errado dentro do
    volume do usuário.
*/

const BLOCK_SIZE = 512
const MAX_NAME_LENGTH = 100

const Octal = (value, length) =>
    value.toString(8).padStart(length - 1, "0") + "\0"

/*
    Checksum do cabeçalho: soma de todos os bytes, com o próprio campo de
    checksum contado como espaços. É a regra do formato — não é escolha nossa.
*/
const WriteChecksum = (header) => {
    header.write(" ".repeat(8), 148, 8, "utf-8")
    let soma = 0
    for (const byte of header) soma += byte
    header.write(Octal(soma, 7) + " ", 148, 8, "utf-8")
}

const BuildTarWithSingleFile = ({ name, content, mode = 0o644, mtimeSeconds = 0 }) => {
    if (typeof name !== "string" || name.length === 0) {
        throw new Error("Nome de arquivo obrigatório para empacotar.")
    }
    if (Buffer.byteLength(name, "utf-8") > MAX_NAME_LENGTH) {
        throw new Error(`Nome de arquivo longo demais para o formato TAR (máximo ${MAX_NAME_LENGTH} bytes).`)
    }

    const corpo = Buffer.isBuffer(content) ? content : Buffer.from(content ?? "", "utf-8")

    const header = Buffer.alloc(BLOCK_SIZE)
    header.write(name, 0, MAX_NAME_LENGTH, "utf-8")
    header.write(Octal(mode, 8), 100, 8, "utf-8")          // mode
    header.write(Octal(0, 8), 108, 8, "utf-8")             // uid
    header.write(Octal(0, 8), 116, 8, "utf-8")             // gid
    header.write(Octal(corpo.length, 12), 124, 12, "utf-8") // size
    header.write(Octal(mtimeSeconds, 12), 136, 12, "utf-8") // mtime
    header.write("0", 156, 1, "utf-8")                      // typeflag: arquivo comum
    header.write("ustar\0", 257, 6, "utf-8")
    header.write("00", 263, 2, "utf-8")
    WriteChecksum(header)

    const restoDoBloco = (BLOCK_SIZE - (corpo.length % BLOCK_SIZE)) % BLOCK_SIZE
    const preenchimento = Buffer.alloc(restoDoBloco)
    // Dois blocos zerados fecham o arquivo — sem eles, o tar é considerado
    // truncado e o Docker recusa.
    const fim = Buffer.alloc(BLOCK_SIZE * 2)

    return Buffer.concat([header, corpo, preenchimento, fim])
}

const ReadString = (buffer, offset, length) => {
    const bruto = buffer.subarray(offset, offset + length)
    const fim = bruto.indexOf(0)
    return bruto.subarray(0, fim === -1 ? bruto.length : fim).toString("utf-8")
}

/*
    Lê as entradas de um TAR. Devolve nome, tamanho e tipo de cada uma, e o
    CONTEÚDO só quando pedido (`withContent`) — o mesmo tar de um diretório
    inteiro pode ser grande, e listar não deveria custar o dobro de memória.

    Cabeçalho inválido interrompe a leitura em vez de tentar adivinhar: um tar
    corrompido pela metade devolve o que deu para ler, com `truncated: true`,
    porque inventar o resto seria pior que admitir o corte.
*/
const ReadTarEntries = (buffer, { withContent = false } = {}) => {
    const entries = []
    let offset = 0
    let truncated = false

    while (offset + BLOCK_SIZE <= buffer.length) {
        const header = buffer.subarray(offset, offset + BLOCK_SIZE)

        // Bloco zerado = fim do arquivo.
        if (header.every((byte) => byte === 0)) break

        const name = ReadString(header, 0, MAX_NAME_LENGTH)
        const sizeOctal = ReadString(header, 124, 12).trim()
        const size = parseInt(sizeOctal, 8)
        const typeflag = ReadString(header, 156, 1) || "0"

        if (!name || Number.isNaN(size)) {
            truncated = true
            break
        }

        const inicio = offset + BLOCK_SIZE
        const fim = inicio + size
        if (fim > buffer.length) {
            truncated = true
            break
        }

        entries.push({
            name,
            size,
            isDirectory: typeflag === "5" || name.endsWith("/"),
            ...(withContent && typeflag !== "5" ? { content: buffer.subarray(inicio, fim) } : {})
        })

        offset = fim + ((BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE)
    }

    return { entries, truncated }
}

/*
    O primeiro arquivo comum de um tar. É o que `getArchive` de um caminho de
    arquivo único devolve — e o que precisamos para baixar um arquivo do espaço.
*/
const ExtractFirstFileFromTar = (buffer) => {
    const { entries } = ReadTarEntries(buffer, { withContent: true })
    const arquivo = entries.find((entry) => !entry.isDirectory)
    if (!arquivo) return null
    return { name: arquivo.name, content: arquivo.content, size: arquivo.size }
}

module.exports = {
    BuildTarWithSingleFile,
    ReadTarEntries,
    ExtractFirstFileFromTar,
    BLOCK_SIZE,
    MAX_NAME_LENGTH
}
