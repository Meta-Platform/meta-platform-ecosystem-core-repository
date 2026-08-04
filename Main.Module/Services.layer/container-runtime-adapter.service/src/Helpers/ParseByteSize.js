/*
    Tamanho em bytes, aceitando a forma que as pessoas escrevem.

    Limite de memória é o campo que mais se digita à mão num formulário de
    container, e ninguém digita 536870912. Digita-se "512m", "2g", "1.5G".

    A API do Docker só aceita o número em bytes. Traduzir aqui, uma vez, evita
    que cada tela invente a sua conta — e evita o erro clássico de tratar "512m"
    como 512, que passa pela validação e cria um container com meio kilobyte de
    memória que morre no primeiro instante.

    Unidades em POTÊNCIAS DE 1024, como o `docker run` faz: k/m/g/t são KiB,
    MiB, GiB, TiB. É a convenção do Docker, e divergir dela produziria um
    limite diferente do que o mesmo texto produz na linha de comando.

    Função pura.
*/

const MULTIPLICADORES = {
    b: 1,
    k: 1024,
    kb: 1024,
    m: 1024 ** 2,
    mb: 1024 ** 2,
    g: 1024 ** 3,
    gb: 1024 ** 3,
    t: 1024 ** 4,
    tb: 1024 ** 4
}

const CriarErro = (mensagem, campo) => {
    const erro = new Error(mensagem)
    erro.code = "INVALID_BYTE_SIZE"
    erro.httpStatus = 400
    erro.statusCode = 400
    if (campo) erro.field = campo
    return erro
}

const ParseByteSize = (valor, campo) => {
    if (valor === undefined || valor === null || valor === "") return undefined

    if (typeof valor === "number") {
        if (!Number.isFinite(valor) || valor < 0) {
            throw CriarErro(`Tamanho inválido: ${valor}.`, campo)
        }
        return Math.floor(valor)
    }

    const texto = String(valor).trim().toLowerCase()
    const casou = texto.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]*)$/)

    if (!casou) {
        throw CriarErro(
            `Tamanho inválido: "${valor}". Use bytes ou sufixo, ex.: 512m, 2g.`,
            campo
        )
    }

    const numero = Number(casou[1].replace(",", "."))
    const unidade = casou[2] || "b"

    if (!(unidade in MULTIPLICADORES)) {
        throw CriarErro(
            `Unidade desconhecida em "${valor}". Use uma de: ${Object.keys(MULTIPLICADORES).join(", ")}.`,
            campo
        )
    }

    return Math.floor(numero * MULTIPLICADORES[unidade])
}

/*
    CPUs em nanossegundos por segundo, que é como a API mede.

    `--cpus 1.5` do docker run vira `NanoCpus: 1500000000`. Mandar 1.5 direto
    faz o daemon entender 1,5 nanossegundo de CPU — o container nasce sem
    conseguir executar nada, e o erro não diz isso.
*/
const CpusToNanoCpus = (cpus, campo) => {
    if (cpus === undefined || cpus === null || cpus === "") return undefined

    const numero = Number(String(cpus).replace(",", "."))
    if (!Number.isFinite(numero) || numero <= 0) {
        throw CriarErro(`Quantidade de CPUs inválida: ${cpus}.`, campo)
    }

    return Math.round(numero * 1e9)
}

module.exports = ParseByteSize
module.exports.ParseByteSize = ParseByteSize
module.exports.CpusToNanoCpus = CpusToNanoCpus
