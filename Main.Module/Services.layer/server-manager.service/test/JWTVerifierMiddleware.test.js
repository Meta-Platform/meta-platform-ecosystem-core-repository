const { test } = require("node:test")
const assert = require("node:assert")

const jwt = require("jsonwebtoken")

const JWTVerifierMiddlewareService = require("../src/Services/JWTVerifierMiddleware.service")

// Para rodar:  node --test test/
// (jsonwebtoken vem das dependências do provisionamento; use NODE_PATH se preciso)

const SECRET = "segredo-de-teste"

/*
 * Um dublê do WebSocket do express-ws: registra os handlers e guarda como foi
 * fechado, que é o que interessa verificar.
 */
const CreateFakeWebSocket = () => {

    const handlers = {}

    return {
        closedWith : null,
        on         : function (event, handler) { handlers[event] = handler },
        close      : function (code, reason) { this.closedWith = { code, reason } },
        Emit       : (event) => handlers[event] && handlers[event]()
    }
}

const CreateRequest = (token) => ({ cookies : { token }, headers : {} })

const OpenSocket = async ({ token, tokenRevocationCheckerService, revocationRecheckIntervalMs }) => {

    const middlewareService = JWTVerifierMiddlewareService({
        secretKey : SECRET,
        tokenRevocationCheckerService,
        revocationRecheckIntervalMs,
        onReady   : () => {}
    })

    const ws = CreateFakeWebSocket()

    let erroDaAbertura = null
    await middlewareService.GetWebSocketMiddleware()(ws, CreateRequest(token), (error) => { erroDaAbertura = error })

    return { ws, erroDaAbertura }
}

const Aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// VDRP-245: quem faz logout com um painel aberto continuava recebendo o fluxo do
// socket até a conexão cair sozinha — a autorização valia só na abertura.
test("conexão já aberta é derrubada quando o token passa a estar revogado", async () => {

    const token = jwt.sign({ userId : "u-1" }, SECRET, { expiresIn : "1h" })

    let revogado = false

    const { ws, erroDaAbertura } = await OpenSocket({
        token,
        tokenRevocationCheckerService : { IsTokenRevoked : async () => revogado },
        revocationRecheckIntervalMs   : 20
    })

    assert.strictEqual(erroDaAbertura, undefined, "a abertura é autorizada enquanto a sessão vale")
    assert.strictEqual(ws.closedWith, null, "socket segue aberto antes da revogação")

    revogado = true
    await Aguardar(80)

    assert.ok(ws.closedWith, "a revogação derruba a conexão viva")
    assert.strictEqual(ws.closedWith.code, 4401, "fecha com o código de sessão encerrada")
})

test("conexão é derrubada quando o próprio token expira", async () => {

    /* Expirado há um segundo: assinado com `exp` no passado. */
    const agoraEmSegundos = Math.floor(Date.now() / 1000)
    const token = jwt.sign({ userId : "u-1", exp : agoraEmSegundos - 1 }, SECRET)

    /* A abertura recusaria por expiração, então montamos o watcher com um token
     * válido e expiramos em seguida — o caminho real: o socket abre válido e o
     * prazo vence com ele aberto. */
    const tokenValido = jwt.sign({ userId : "u-1", exp : agoraEmSegundos + 1 }, SECRET)

    const { ws, erroDaAbertura } = await OpenSocket({
        token                       : tokenValido,
        revocationRecheckIntervalMs : 20
    })

    assert.strictEqual(erroDaAbertura, undefined, "abre enquanto o token está dentro do prazo")

    await Aguardar(1200)

    assert.ok(ws.closedWith, "socket não sobrevive ao próprio exp")
    assert.strictEqual(ws.closedWith.code, 4401)

    /* O token expirado existe para deixar explícito o que se está testando. */
    assert.throws(() => jwt.verify(token, SECRET), "o token do cenário está mesmo expirado")
})

test("fechar a conexão encerra a reavaliação", async () => {

    const token = jwt.sign({ userId : "u-1" }, SECRET, { expiresIn : "1h" })

    let consultas = 0

    const { ws } = await OpenSocket({
        token,
        tokenRevocationCheckerService : { IsTokenRevoked : async () => { consultas++; return false } },
        revocationRecheckIntervalMs   : 20
    })

    await Aguardar(60)
    const consultasAteFechar = consultas

    assert.ok(consultasAteFechar > 0, "reavalia enquanto a conexão está aberta")

    ws.Emit("close")
    await Aguardar(80)

    assert.strictEqual(consultas, consultasAteFechar, "não reavalia mais depois que o socket fecha")
})

// A denylist é uma camada a mais, não a única: o IAM fora do ar não pode
// derrubar toda a plataforma autenticada.
test("falha ao consultar a revogação mantém a conexão aberta", async () => {

    const token = jwt.sign({ userId : "u-1" }, SECRET, { expiresIn : "1h" })

    const { ws } = await OpenSocket({
        token,
        tokenRevocationCheckerService : { IsTokenRevoked : async () => { throw new Error("socket do IAM fora do ar") } },
        revocationRecheckIntervalMs   : 20
    })

    await Aguardar(80)

    assert.strictEqual(ws.closedWith, null, "indisponibilidade do IAM não derruba a sessão")
})

test("sem verificador de revogação o comportamento anterior é preservado", async () => {

    const token = jwt.sign({ userId : "u-1" }, SECRET, { expiresIn : "1h" })

    const { ws, erroDaAbertura } = await OpenSocket({ token, revocationRecheckIntervalMs : 20 })

    await Aguardar(80)

    assert.strictEqual(erroDaAbertura, undefined)
    assert.strictEqual(ws.closedWith, null, "sem denylist, nada derruba a conexão dentro do prazo")
})
