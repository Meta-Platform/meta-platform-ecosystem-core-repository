const assert = require("node:assert/strict") as typeof import("node:assert/strict")
const test = require("node:test") as typeof import("node:test")

const BuildErrorResponse = require("../src/Helpers/BuildErrorResponse")

/*
    O caso que motivou o handler: o painel de containers mostrava
    "Request failed with status code 503" porque o corpo do erro era o stack em
    HTML do Express — a mensagem escrita no controller nunca chegava à tela.
*/
test("erro de contrato preserva status, code e mensagem", () => {
    const erro: any = new Error("O adaptador de runtime de containers não está respondendo no socket.")
    erro.code = "CONTAINER_RUNTIME_UNAVAILABLE"
    erro.httpStatus = 503
    erro.statusCode = 503

    assert.deepEqual(BuildErrorResponse(erro), {
        status: 503,
        body: {
            code: "CONTAINER_RUNTIME_UNAVAILABLE",
            message: "O adaptador de runtime de containers não está respondendo no socket."
        }
    })
})

test("statusCode sozinho basta — nem todo erro do ecossistema traz httpStatus", () => {
    const erro: any = new Error("Sem usuário autenticado não há em nome de quem agir.")
    erro.code = "DELEGATED_USER_UNKNOWN"
    erro.statusCode = 401

    const { status, body } = BuildErrorResponse(erro)
    assert.equal(status, 401)
    assert.equal(body.code, "DELEGATED_USER_UNKNOWN")
})

test("erro comum, sem code nem status, vira 500 genérico", () => {
    const { status, body } = BuildErrorResponse(new Error("quebrou"))
    assert.equal(status, 500)
    assert.equal(body.code, "INTERNAL_ERROR")
    assert.equal(body.message, "quebrou")
})

test("string lançada é mensagem, não erro sem mensagem", () => {
    const { status, body } = BuildErrorResponse('O summary "X" do controller "Y" está indefinido!')
    assert.equal(status, 500)
    assert.equal(body.message, 'O summary "X" do controller "Y" está indefinido!')
})

test("status fora da faixa de erro HTTP não é obedecido", () => {
    const erro: any = new Error("código de erro de socket, não de HTTP")
    erro.code = "ECONNREFUSED"
    erro.statusCode = 200

    assert.equal(BuildErrorResponse(erro).status, 500)
})

test("o stack nunca sai no corpo", () => {
    const erro: any = new Error("falhou")
    erro.statusCode = 400

    const { body } = BuildErrorResponse(erro)
    assert.deepEqual(Object.keys(body).sort(), ["code", "message"])
})

test("erro nulo ainda produz resposta utilizável", () => {
    assert.deepEqual(BuildErrorResponse(undefined), {
        status: 500,
        body: { code: "INTERNAL_ERROR", message: "Erro interno ao processar a requisição." }
    })
})
