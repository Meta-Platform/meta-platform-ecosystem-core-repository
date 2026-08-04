const test = require("node:test")
const assert = require("node:assert/strict")

const CreateDockerStreamDecoder = require("../src/Helpers/DecodeDockerStream")

const Quadro = (tipo, texto) => {
    const corpo = Buffer.from(texto, "utf-8")
    const cabecalho = Buffer.alloc(8)
    cabecalho[0] = tipo
    cabecalho.writeUInt32BE(corpo.length, 4)
    return Buffer.concat([cabecalho, corpo])
}

const Coletar = () => {
    const eventos = []
    const decodificador = CreateDockerStreamDecoder({ onData: (evento) => eventos.push(evento) })
    return { eventos, decodificador }
}

test("desenquadra stdout e stderr do fluxo multiplexado", () => {
    const { eventos, decodificador } = Coletar()
    decodificador.Push(Buffer.concat([Quadro(1, "saida\n"), Quadro(2, "erro\n")]))

    assert.deepEqual(eventos, [
        { stream: "stdout", data: "saida\n" },
        { stream: "stderr", data: "erro\n" }
    ])
})

test("fluxo cru (TTY) passa direto, sem procurar quadro", () => {
    const { eventos, decodificador } = Coletar()
    decodificador.Push(Buffer.from("/ # echo ola\r\n", "utf-8"))

    assert.equal(eventos.length, 1)
    assert.equal(eventos[0].data, "/ # echo ola\r\n")
})

test("quadro partido entre dois pedaços é remontado", () => {
    const { eventos, decodificador } = Coletar()
    const quadro = Quadro(1, "mensagem inteira")

    decodificador.Push(quadro.slice(0, 5))
    assert.equal(eventos.length, 0, "não emite antes de ter o quadro completo")

    decodificador.Push(quadro.slice(5, 12))
    assert.equal(eventos.length, 0, "payload ainda incompleto")

    decodificador.Push(quadro.slice(12))
    assert.deepEqual(eventos, [{ stream: "stdout", data: "mensagem inteira" }])
})

test("vários quadros no mesmo pedaço saem na ordem", () => {
    const { eventos, decodificador } = Coletar()
    decodificador.Push(Buffer.concat([Quadro(1, "um"), Quadro(1, "dois"), Quadro(1, "tres")]))

    assert.deepEqual(eventos.map((e) => e.data), ["um", "dois", "tres"])
})

test("texto cru curto não fica preso esperando um quadro que não vem", () => {
    // "ok" tem 2 bytes: menor que um cabeçalho, mas não parece cabeçalho.
    const { eventos, decodificador } = Coletar()
    decodificador.Push(Buffer.from("ok", "utf-8"))

    assert.deepEqual(eventos, [{ stream: "stdout", data: "ok" }])
})

test("ANSI e acentos sobrevivem ao desenquadramento", () => {
    const { eventos, decodificador } = Coletar()
    const texto = "[32mconexão estabelecida[0m\n"
    decodificador.Push(Quadro(1, texto))

    assert.equal(eventos[0].data, texto)
})

test("o que sobra no fim é entregue pelo Flush, não engolido", () => {
    const { eventos, decodificador } = Coletar()
    // Cabeçalho anunciando 50 bytes, mas só 4 chegaram: o fluxo morreu no meio.
    const cabecalho = Buffer.alloc(8)
    cabecalho[0] = 1
    cabecalho.writeUInt32BE(50, 4)
    decodificador.Push(Buffer.concat([cabecalho, Buffer.from("meio", "utf-8")]))
    assert.equal(eventos.length, 0)

    decodificador.Flush()
    assert.equal(eventos.length, 1)
    assert.equal(eventos[0].data.includes("meio"), true)
})

test("pedaço vazio não emite evento", () => {
    const { eventos, decodificador } = Coletar()
    decodificador.Push(Buffer.alloc(0))
    decodificador.Flush()

    assert.deepEqual(eventos, [])
})

/*
    Caractere multibyte partido entre pedaços (CTMG-83).

    O sintoma clássico: um acento vira lixo no meio do texto do terminal, e
    nada no log explica por quê. Acontece porque "ã" são dois bytes e o quadro
    pode terminar entre eles — convertendo pedaço a pedaço, cada metade vira
    U+FFFD.
*/
test("acento partido entre dois pedaços é remontado", () => {
    const recebidos = []
    const decodificador = CreateDockerStreamDecoder({
        onData: ({ data }) => recebidos.push(data)
    })

    const texto = Buffer.from("informação\n", "utf-8")
    // O "ç" ocupa dois bytes; cortamos no meio deles.
    const meio = texto.indexOf(Buffer.from("ç", "utf-8")[0]) + 1

    decodificador.Push(texto.subarray(0, meio))
    decodificador.Push(texto.subarray(meio))
    decodificador.Flush()

    assert.equal(recebidos.join(""), "informação\n")
    assert.equal(recebidos.join("").includes("�"), false)
})

test("stdout e stderr não completam o caractere um do outro", () => {
    /*
        Os fluxos se intercalam. Com um decodificador só, um byte pendente do
        stdout seria completado por um byte do stderr — e as duas saídas
        sairiam corrompidas.
    */
    const porFluxo = { stdout: "", stderr: "" }
    const decodificador = CreateDockerStreamDecoder({
        onData: ({ stream, data }) => { porFluxo[stream] += data }
    })

    const Quadro = (tipo, buffer) => {
        const cabecalho = Buffer.alloc(8)
        cabecalho[0] = tipo === "stderr" ? 2 : 1
        cabecalho.writeUInt32BE(buffer.length, 4)
        return Buffer.concat([cabecalho, buffer])
    }

    const saida = Buffer.from("ção", "utf-8")
    const erro = Buffer.from("não", "utf-8")

    // stdout entra pela metade, stderr inteiro no meio, stdout completa.
    decodificador.Push(Quadro("stdout", saida.subarray(0, 1)))
    decodificador.Push(Quadro("stderr", erro))
    decodificador.Push(Quadro("stdout", saida.subarray(1)))
    decodificador.Flush()

    assert.equal(porFluxo.stdout, "ção")
    assert.equal(porFluxo.stderr, "não")
})
