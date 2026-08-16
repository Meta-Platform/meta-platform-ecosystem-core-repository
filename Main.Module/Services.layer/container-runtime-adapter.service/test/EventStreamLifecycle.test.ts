/*
    Ciclo de vida do stream de eventos (CTMG-32).

    O que se verifica aqui é sobretudo o que NÃO deve acontecer: adaptador
    criado não abre socket. Como o gerenciador mantém um adaptador em cache por
    conexão cadastrada, abrir na construção significava um socket por conexão —
    e uma conexão remota morta virava erro repetido no log de quem estava
    trabalhando noutra conexão.
*/
const test = require("node:test")
const assert = require("node:assert/strict")
const { EventEmitter } = require("node:events")

const ContainerManager = require("../src/Managers/Container.manager")

const CriarStreamFalso = () => {
    const stream = new EventEmitter()
    stream.destruido = false
    stream.destroy = () => { stream.destruido = true }
    return stream
}

/*
    `respostas` é a fila de respostas do getEvents: um erro ou um stream por
    chamada, na ordem em que forem pedidas.
*/
const CriarManagerDuplo = ({ respostas = [] } = {}) => {
    const chamadasDeGetEvents = []

    const clienteFalso = {
        getEvents: (options, callback) => {
            chamadasDeGetEvents.push(options)
            const resposta = respostas.shift() || { stream: CriarStreamFalso() }
            // Assíncrono como o de verdade.
            setImmediate(() => {
                if (resposta.erro) return callback(resposta.erro)
                callback(null, resposta.stream)
            })
        }
    }

    const manager = ContainerManager({
        socketPath: "/tmp/irrelevante.sock",
        CreateClient: () => clienteFalso
    })

    return { manager, chamadasDeGetEvents }
}

const Aguardar = () => new Promise((resolve) => setImmediate(resolve))

test("criar o adaptador NÃO abre stream de eventos", async () => {
    const { manager, chamadasDeGetEvents } = CriarManagerDuplo()
    await Aguardar()

    assert.equal(chamadasDeGetEvents.length, 0)
    assert.deepEqual(manager.GetEventStreamState(), {
        open: false,
        subscribers: 0,
        lastError: null,
        retryInMs: null
    })
})

test("o primeiro assinante abre o stream", async () => {
    const { manager, chamadasDeGetEvents } = CriarManagerDuplo()

    manager.RegisterDockerEventListener(() => {})
    await Aguardar()

    assert.equal(chamadasDeGetEvents.length, 1)
    assert.equal(manager.GetEventStreamState().open, true)
    assert.equal(manager.GetEventStreamState().subscribers, 1)
})

test("o segundo assinante reaproveita o mesmo stream", async () => {
    const { manager, chamadasDeGetEvents } = CriarManagerDuplo()

    manager.RegisterDockerEventListener(() => {})
    await Aguardar()
    manager.RegisterDockerEventListener(() => {})
    await Aguardar()

    assert.equal(chamadasDeGetEvents.length, 1, "um stream só para dois assinantes")
    assert.equal(manager.GetEventStreamState().subscribers, 2)
})

test("sair o último assinante fecha o stream", async () => {
    const stream = CriarStreamFalso()
    const { manager } = CriarManagerDuplo({ respostas: [{ stream }] })

    const soltar = manager.RegisterDockerEventListener(() => {})
    await Aguardar()
    assert.equal(manager.GetEventStreamState().open, true)

    soltar()

    assert.equal(stream.destruido, true)
    assert.equal(manager.GetEventStreamState().open, false)
    assert.equal(manager.GetEventStreamState().subscribers, 0)
})

test("o evento chega a quem assinou", async () => {
    const stream = CriarStreamFalso()
    const { manager } = CriarManagerDuplo({ respostas: [{ stream }] })

    const recebidos = []
    manager.RegisterDockerEventListener((evento) => recebidos.push(evento))
    await Aguardar()

    stream.emit("data", Buffer.from(JSON.stringify({ Type: "container", Action: "start" })))

    assert.deepEqual(recebidos, [{ Type: "container", Action: "start" }])
})

test("quem soltou a assinatura não recebe mais evento", async () => {
    const stream = CriarStreamFalso()
    const { manager } = CriarManagerDuplo({ respostas: [{ stream }] })

    const recebidos = []
    const soltar = manager.RegisterDockerEventListener((evento) => recebidos.push(evento))
    await Aguardar()

    // Segundo assinante mantém o stream vivo depois que o primeiro sai.
    manager.RegisterDockerEventListener(() => {})
    await Aguardar()

    soltar()
    stream.emit("data", Buffer.from(JSON.stringify({ Type: "container", Action: "die" })))

    assert.deepEqual(recebidos, [])
})

test("linha inválida no stream não derruba nem polui", async () => {
    const stream = CriarStreamFalso()
    const { manager } = CriarManagerDuplo({ respostas: [{ stream }] })

    const recebidos = []
    manager.RegisterDockerEventListener((evento) => recebidos.push(evento))
    await Aguardar()

    stream.emit("data", Buffer.from("{ isto não é json"))
    stream.emit("data", Buffer.from(JSON.stringify({ Type: "image", Action: "pull" })))

    assert.deepEqual(recebidos, [{ Type: "image", Action: "pull" }])
})

test("falha ao abrir vira estado consultável e reconexão agendada", async () => {
    const { manager } = CriarManagerDuplo({
        respostas: [{ erro: new Error("connect ECONNREFUSED") }]
    })

    manager.RegisterDockerEventListener(() => {})
    await Aguardar()

    const estado = manager.GetEventStreamState()
    assert.equal(estado.open, false)
    assert.equal(estado.lastError, "connect ECONNREFUSED")
    assert.equal(typeof estado.retryInMs, "number")
})

test("soltar a assinatura cancela a reconexão pendente", async () => {
    const { manager } = CriarManagerDuplo({
        respostas: [{ erro: new Error("connect ECONNREFUSED") }]
    })

    const soltar = manager.RegisterDockerEventListener(() => {})
    await Aguardar()
    soltar()

    assert.equal(manager.GetEventStreamState().retryInMs, null)
})
