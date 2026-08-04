/*
    Coleta todo o conteúdo de um stream legível em um único Buffer.

    Usado por quem exporta (imagem, container, arquivo de volume): a API do
    runtime entrega um tar como stream e o contrato de resposta deste pacote é
    base64 num JSON.

    ATENÇÃO ao custo: o conteúdo inteiro passa pela memória, e o base64 ainda o
    infla ~1,37×. Para exportação de imagem e volume isso já é um limite
    conhecido — ver CTMG-93 e CTMG-101, que introduzem um teto explícito.
*/
const StreamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = []
        stream.on('data', (chunk) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
    })

module.exports = StreamToBuffer
