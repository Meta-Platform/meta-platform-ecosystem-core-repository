/*
    Coleta todo o conteúdo de um stream legível em um único Buffer.

    Usado por quem exporta (imagem, container, arquivo de volume): a API do
    runtime entrega um tar como stream e o contrato de resposta deste pacote é
    base64 num JSON.

    ATENÇÃO ao custo: o conteúdo inteiro passa pela memória, e o base64 ainda o
    infla ~1,37×. É por isso que existe o TETO abaixo (CTMG-93 e CTMG-101).

    ## Por que o teto não é opcional

    Sem teto, um tar grande demais não vira erro: vira `RangeError: Array
    buffer allocation failed` dentro do `Buffer.concat`. E como esse erro nasce
    no ouvinte de `end` — fora da cadeia da Promise —, ele NÃO chega ao
    `reject`: sobe como exceção não tratada e derruba o processo inteiro. No
    aplicativo de mesa isso aparecia como o diálogo "A JavaScript error
    occurred in the main process", sem nenhuma pista de qual operação pediu o
    quê.

    Com o teto, o mesmo caso vira uma resposta 413 com o tamanho no texto, e
    quem pediu continua de pé. Por isso o `Buffer.concat` também está protegido:
    memória apertada pode fazê-lo falhar bem abaixo do teto, e o destino desse
    erro é o `reject`, nunca o processo.

    QUEM SÓ PRECISA DOS CABEÇALHOS de um tar não deveria estar aqui: veja
    `ReadTarEntriesFromStream` em `TarSingleFile.js`, que lê a listagem em fluxo
    e não guarda o conteúdo.
*/

import type { OperationError, StreamToBufferFn } from "../Operations/Types"

const TETO_PADRAO_EM_BYTES = 256 * 1024 * 1024

const EmMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const StreamToBuffer: StreamToBufferFn = (stream, { limiteEmBytes = TETO_PADRAO_EM_BYTES, descricao = "O conteúdo" } = {}) =>
    new Promise((resolve, reject) => {
        let chunks: Buffer[] = []
        let total = 0
        let encerrado = false

        const UmaVezSo = (Acao: (valor?: any) => void) => (valor?: any) => {
            if (encerrado) return
            encerrado = true
            Acao(valor)
        }

        const Resolver = UmaVezSo(resolve)

        const Rejeitar = UmaVezSo((erro: any) => {
            // Solta os pedaços já lidos antes de rejeitar: quem estourou o teto
            // é justamente quem não pode continuar segurando memória.
            chunks = []
            stream.destroy()
            reject(erro)
        })

        stream.on("data", (chunk: Buffer) => {
            total += chunk.length

            if (limiteEmBytes !== null && total > limiteEmBytes) {
                const erro: OperationError = new Error(
                    `${descricao} excede o limite de ${EmMegabytes(limiteEmBytes)} ` +
                    `que este serviço carrega em memória.`
                )
                erro.code = "CONTENT_TOO_LARGE"
                erro.httpStatus = 413
                erro.statusCode = 413
                Rejeitar(erro)
                return
            }

            chunks.push(chunk)
        })

        stream.on("end", () => {
            try {
                Resolver(Buffer.concat(chunks))
            } catch (falha: any) {
                const erro: OperationError = new Error(
                    `Não foi possível reunir ${EmMegabytes(total)} em memória: ${falha.message}`
                )
                erro.code = "CONTENT_TOO_LARGE"
                erro.httpStatus = 413
                erro.statusCode = 413
                erro.cause = falha
                Rejeitar(erro)
            }
        })

        stream.on("error", Rejeitar)
    })

module.exports = StreamToBuffer
module.exports.TETO_PADRAO_EM_BYTES = TETO_PADRAO_EM_BYTES
