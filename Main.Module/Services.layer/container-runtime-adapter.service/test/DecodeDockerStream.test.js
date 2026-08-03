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
