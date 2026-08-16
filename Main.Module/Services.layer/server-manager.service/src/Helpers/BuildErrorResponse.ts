/*
    Tradução de um erro de controller para a resposta HTTP que o cliente lê.

    Antes disto, `next(e)` caía no tratador padrão do Express: status certo,
    corpo em HTML com o stack. Para quem consome a API o corpo era inútil —
    `error.response.data.message` não existia — e as telas exibiam o texto do
    axios ("Request failed with status code 503"), escondendo mensagens que o
    controller tinha escrito exatamente para serem lidas por um operador.

    Função pura de propósito: a regra de qual status sai e o que vai no corpo é
    verificável sem subir servidor.

    `stack` NUNCA entra no corpo. Ele acompanha o erro no log do serviço, que é
    onde se depura; na resposta, seria estrutura interna entregue a qualquer
    cliente autenticado.
*/

const DEFAULT_STATUS = 500
const DEFAULT_CODE = "INTERNAL_ERROR"
const DEFAULT_MESSAGE = "Erro interno ao processar a requisição."

const IsValidStatus = (value: any): value is number =>
    Number.isInteger(value) && value >= 400 && value <= 599

const BuildErrorResponse = (error: any): { status: number, body: { code: string, message: string } } => {

    // Uma string lançada (`throw "..."`, que este código-base ainda usa em
    // alguns pontos) é uma mensagem, não um erro sem mensagem.
    if (typeof error === "string") {
        return { status: DEFAULT_STATUS, body: { code: DEFAULT_CODE, message: error } }
    }

    const candidato = error?.httpStatus ?? error?.statusCode ?? error?.status
    const status = IsValidStatus(candidato) ? candidato : DEFAULT_STATUS

    const code = typeof error?.code === "string" && error.code.length > 0
        ? error.code
        : DEFAULT_CODE

    const message = typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : DEFAULT_MESSAGE

    return { status, body: { code, message } }
}

module.exports = BuildErrorResponse
