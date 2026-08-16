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

import type { TarEntry } from "../Operations/Types"

const BLOCK_SIZE = 512
const MAX_NAME_LENGTH = 100

// Cabeçalho estendido do PAX cabe em poucos bytes; acima disto é anomalia, e
// anomalia não ganha memória nossa.
const TETO_DE_METADADO_EM_BYTES = 64 * 1024

const Octal = (value: number, length: number) =>
    value.toString(8).padStart(length - 1, "0") + "\0"

/*
    Checksum do cabeçalho: soma de todos os bytes, com o próprio campo de
    checksum contado como espaços. É a regra do formato — não é escolha nossa.
*/
const WriteChecksum = (header: Buffer) => {
    header.write(" ".repeat(8), 148, 8, "utf-8")
    let soma = 0
    for (const byte of header) soma += byte
    header.write(Octal(soma, 7) + " ", 148, 8, "utf-8")
}

const BuildTarWithSingleFile = ({ name, content, mode = 0o644, mtimeSeconds = 0 }: {
    name?: unknown
    content?: Buffer | string | null
    mode?: number
    mtimeSeconds?: number
}): Buffer => {
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

const ReadString = (buffer: Buffer, offset: number, length: number): string => {
    const bruto = buffer.subarray(offset, offset + length)
    const fim = bruto.indexOf(0)
    return bruto.subarray(0, fim === -1 ? bruto.length : fim).toString("utf-8")
}

/*
    Decodifica UM cabeçalho de 512 bytes. Devolve `null` quando o bloco não é
    um cabeçalho reconhecível — quem chama trata isso como corte, não como
    entrada vazia.

    Permissão e data de modificação (CTMG-44) só passaram a importar quando o
    navegador de ARQUIVOS DE CONTAINER chegou: com o container parado não há
    processo para rodar `stat`, e os cabeçalhos do tar são a única fonte desses
    campos. Sem eles, a mesma tela mostraria colunas vazias dependendo de o
    container estar de pé ou não.
*/
const ReadHeader = (header: Buffer): (TarEntry & { typeflag: string }) | null => {
    const name = ReadString(header, 0, MAX_NAME_LENGTH)
    const size = parseInt(ReadString(header, 124, 12).trim(), 8)
    const typeflag = ReadString(header, 156, 1) || "0"

    if (!name || Number.isNaN(size)) return null

    const modeOctal = ReadString(header, 100, 8).trim()
    const mtimeOctal = ReadString(header, 136, 12).trim()
    const mode = modeOctal ? parseInt(modeOctal, 8) : null
    const mtimeSeconds = mtimeOctal ? parseInt(mtimeOctal, 8) : null

    /*
        O campo `prefix` do USTAR (CTMG-101).

        ESCREVER continua sendo só `name` — a nota no topo do arquivo vale, e
        nome longo demais é recusado em vez de truncado. Mas LER é outra
        história: o tar de um filesystem inteiro vem cheio de caminhos que não
        cabem em 100 bytes, e ignorar o prefixo não devolvia menos entradas —
        devolvia entradas ERRADAS. `/usr/lib/python3/__pycache__/` chegava aqui
        como `__pycache__/`, e um filtro de "só o primeiro nível" deixava
        passar: a listagem de `/` mostrava 18 mil linhas em vez de vinte, com o
        mesmo nome repetido de pastas fundo adentro.
    */
    const prefix = ReadString(header, 345, 155)
    const caminho = prefix ? `${prefix}/${name}` : name

    return {
        name: caminho,
        size,
        typeflag,
        isDirectory: typeflag === "5" || caminho.endsWith("/"),
        mode: Number.isNaN(mode) ? null : mode,
        mtimeSeconds: Number.isNaN(mtimeSeconds) ? null : mtimeSeconds
    }
}

const Preenchimento = (size: number) => (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE

const BlocoZerado = (bloco: Buffer) => bloco.every((byte) => byte === 0)

/*
    Entradas que não são arquivo: carregam METADADO da entrada seguinte.

    `x` é o cabeçalho estendido do PAX — que é o que o Go usa (e portanto o
    Docker) quando nem `prefix` dá conta do caminho —, e `L` é o nome longo do
    GNU tar. Nos dois casos o nome de verdade está no CONTEÚDO, e o bloco em si
    não é um arquivo para mostrar na tela. `g` é o global do PAX, que não
    descreve entrada nenhuma.
*/
const EhMetadado = (typeflag: string) => typeflag === "x" || typeflag === "g" ||
    typeflag === "L" || typeflag === "K"

/*
    Extrai o caminho anunciado por um bloco de metadado. PAX guarda registros
    no formato `TAMANHO chave=valor\n`; o GNU guarda o nome cru, terminado em
    zero. Metadado que não fala de caminho (data, dono, ACL) devolve `null` e
    não muda nada.
*/
const ReadPathFromMetadata = (typeflag: string, conteudo: Buffer): string | null => {
    if (typeflag === "L" || typeflag === "K") {
        const texto = conteudo.toString("utf-8")
        const fim = texto.indexOf("\0")
        const nome = (fim === -1 ? texto : texto.slice(0, fim)).trim()
        return nome || null
    }

    if (typeflag !== "x") return null

    for (const registro of conteudo.toString("utf-8").split("\n")) {
        const separador = registro.indexOf("=")
        if (separador === -1) continue
        const chave = registro.slice(0, separador).split(" ").pop()
        if (chave === "path") return registro.slice(separador + 1)
    }

    return null
}

/*
    Lê as entradas de um TAR. Devolve nome, tamanho e tipo de cada uma, e o
    CONTEÚDO só quando pedido (`withContent`) — o mesmo tar de um diretório
    inteiro pode ser grande, e listar não deveria custar o dobro de memória.

    Cabeçalho inválido interrompe a leitura em vez de tentar adivinhar: um tar
    corrompido pela metade devolve o que deu para ler, com `truncated: true`,
    porque inventar o resto seria pior que admitir o corte.
*/
const ReadTarEntries = (buffer: Buffer, { withContent = false }: { withContent?: boolean } = {}) => {
    const entries: TarEntry[] = []
    let offset = 0
    let truncated = false
    let caminhoAnunciado: string | null = null

    while (offset + BLOCK_SIZE <= buffer.length) {
        const header = buffer.subarray(offset, offset + BLOCK_SIZE)

        // Bloco zerado = fim do arquivo.
        if (BlocoZerado(header)) break

        const entrada = ReadHeader(header)
        if (!entrada) {
            truncated = true
            break
        }

        const inicio = offset + BLOCK_SIZE
        const fim = inicio + entrada.size
        if (fim > buffer.length) {
            truncated = true
            break
        }

        const { typeflag, ...campos } = entrada
        offset = fim + Preenchimento(entrada.size)

        if (EhMetadado(typeflag)) {
            caminhoAnunciado = ReadPathFromMetadata(typeflag, buffer.subarray(inicio, fim))
            continue
        }

        const nome = caminhoAnunciado || campos.name
        caminhoAnunciado = null

        entries.push({
            ...campos,
            name: nome,
            isDirectory: typeflag === "5" || nome.endsWith("/"),
            ...(withContent && typeflag !== "5" ? { content: buffer.subarray(inicio, fim) } : {})
        })
    }

    return { entries, truncated }
}

/*
    A MESMA leitura, porém sobre um fluxo e SEM guardar o conteúdo.

    Existe por causa de um caso que derrubava o processo: listar `/` de um
    container PARADO. Sem processo de pé não há `stat` para rodar, então a
    listagem vem do `getArchive` — e `getArchive` de um diretório traz o
    conteúdo recursivo inteiro. Juntar isso num Buffer para depois olhar só os
    cabeçalhos custava o filesystem todo em memória; num painel de serviço, GBs.

    Aqui os bytes do conteúdo são CONTADOS e descartados: a memória fica na
    ordem da lista de nomes, e não do tar. O fluxo ainda é lido até o fim —
    a API do Docker não oferece profundidade —, mas ler não é guardar.
*/
const ReadTarEntriesFromStream = (stream: any) =>
    new Promise<{ entries: TarEntry[], truncated: boolean }>((resolve, reject) => {
        const entries: TarEntry[] = []
        let pendente: Buffer = Buffer.alloc(0)
        let aDescartar = 0
        let fechado = false
        let truncated = false

        /*
            O bloco de metadado (PAX ou GNU) é o ÚNICO cujo conteúdo importa
            aqui — ele carrega o caminho longo da entrada seguinte. É pequeno
            por natureza, mas o teto existe mesmo assim: um tar forjado não
            deveria conseguir crescer a memória por um campo que ninguém lê
            inteiro.
        */
        let metadadoEmCurso: { typeflag: string, partes: Buffer[] } | null = null
        let caminhoAnunciado: string | null = null

        const Consumir = (chunk: Buffer) => {
            pendente = pendente.length === 0 ? chunk : Buffer.concat([pendente, chunk])

            while (true) {
                if (aDescartar > 0) {
                    const disponivel = Math.min(aDescartar, pendente.length)

                    if (metadadoEmCurso) {
                        metadadoEmCurso.partes.push(pendente.subarray(0, disponivel))
                    }

                    pendente = pendente.subarray(disponivel)
                    aDescartar -= disponivel
                    if (aDescartar > 0) return

                    if (metadadoEmCurso) {
                        caminhoAnunciado = ReadPathFromMetadata(
                            metadadoEmCurso.typeflag,
                            Buffer.concat(metadadoEmCurso.partes)
                        )
                        metadadoEmCurso = null
                    }
                }

                if (pendente.length < BLOCK_SIZE) return

                const header = pendente.subarray(0, BLOCK_SIZE)
                if (BlocoZerado(header)) {
                    fechado = true
                    return
                }

                const entrada = ReadHeader(header)
                if (!entrada) {
                    truncated = true
                    fechado = true
                    return
                }

                const { typeflag, ...campos } = entrada

                if (EhMetadado(typeflag) && entrada.size <= TETO_DE_METADADO_EM_BYTES) {
                    metadadoEmCurso = { typeflag, partes: [] }
                } else if (!EhMetadado(typeflag)) {
                    const nome = caminhoAnunciado || campos.name
                    caminhoAnunciado = null
                    entries.push({
                        ...campos,
                        name: nome,
                        isDirectory: typeflag === "5" || nome.endsWith("/")
                    })
                }

                pendente = pendente.subarray(BLOCK_SIZE)
                aDescartar = entrada.size + Preenchimento(entrada.size)
            }
        }

        stream.on("data", (chunk: Buffer) => {
            if (fechado) return
            try {
                Consumir(chunk)
            } catch (falha) {
                fechado = true
                truncated = true
                reject(falha)
            }
        })

        // Fim antes do bloco zerado é corte real: dizemos, em vez de fingir
        // que a lista está completa.
        stream.on("end", () => resolve({ entries, truncated: truncated || !fechado }))
        stream.on("error", reject)
    })

/*
    O primeiro arquivo comum de um tar. É o que `getArchive` de um caminho de
    arquivo único devolve — e o que precisamos para baixar um arquivo do espaço.
*/
const ExtractFirstFileFromTar = (buffer: Buffer) => {
    const { entries } = ReadTarEntries(buffer, { withContent: true })
    const arquivo = entries.find((entry) => !entry.isDirectory)
    if (!arquivo) return null
    return { name: arquivo.name, content: arquivo.content, size: arquivo.size }
}

module.exports = {
    BuildTarWithSingleFile,
    ReadTarEntries,
    ReadTarEntriesFromStream,
    ExtractFirstFileFromTar,
    BLOCK_SIZE,
    MAX_NAME_LENGTH
}
