const jwt = require("jsonwebtoken")

const ExtractTokenByRequest = (request) => {
    const {
        cookies,
        headers
    } = request

    if (cookies.token) {
        return cookies.token
    } else if (headers.authorization && headers.authorization.split(' ')[0] === 'Bearer') {
        return headers.authorization.split(' ')[1]
    } else return null
}

/*
    Verificador de token compartilhado por todos os webservices montados no
    mesmo server-service.

    DENYLIST (VDRP-212) — por que existe um bound-param opcional aqui

    Assinatura válida e prazo não vencido não são a mesma coisa que sessão
    ativa: depois de um logout, o token continua íntegro e dentro do `exp`. Sem
    consultar uma lista de revogados, este middleware aceitava, por até uma
    hora, o token de quem já tinha saído — em TODOS os webservices, porque ele é
    um singleton compartilhado.

    Quem sabe o que foi revogado é o produto que monta o middleware, não este
    pacote: a denylist é do domínio de identidade, e este é um utilitário de
    servidor. Por isso a verificação entra como colaborador opcional
    (`tokenRevocationCheckerService`) em vez de virar dependência. Sem ele, o
    comportamento é exatamente o anterior.
*/
const JWTVerifierMiddlewareService = (params) => {

    const {
        secretKey,
        tokenRevocationCheckerService,
        onReady
    } = params

    const Unauthorized = (response) => response.status(401).json({
        error: 'Unauthorized'
    })

    /*
        FALHA ABERTA, E ISSO É DELIBERADO.

        Se a consulta de revogação falhar (o IAM fora do ar, socket recriado),
        o token segue valendo pelo que ele é: uma credencial assinada e dentro
        do prazo. Falhar fechado transformaria uma indisponibilidade do IAM em
        queda de TODA a plataforma autenticada — e a denylist é uma camada a
        mais, não a única.

        A falha é registrada. Silenciá-la faria a proteção sumir sem que
        ninguém percebesse, que é o pior dos dois mundos.
    */
    const _IsRevoked = async (authenticationData) => {
        if (!tokenRevocationCheckerService) return false
        try {
            return await tokenRevocationCheckerService.IsTokenRevoked(authenticationData) === true
        } catch(e) {
            console.error(`[jwt-verifier] falha ao consultar a revogação — token aceito pela assinatura: ${e && e.message ? e.message : e}`)
            return false
        }
    }

    const GetMiddleware = () => async (request, response, next) => {
        try{
            const token = ExtractTokenByRequest(request)
            const authenticationData = jwt.verify(token, secretKey)

            if (await _IsRevoked(authenticationData)) return Unauthorized(response)

            request.authenticationData = authenticationData
            next()
        }catch(e){
            Unauthorized(response)
        }
    }

    const GetWebSocketMiddleware = () => async (ws, request, next) => {
        try{
            const token = ExtractTokenByRequest(request)
            const authenticationData = jwt.verify(token, secretKey)

            // O socket é aberto UMA vez e vive por horas — é o caminho onde um
            // token revogado sobrevive por mais tempo. Recusar a abertura é o
            // mínimo; derrubar conexões já abertas é outro item.
            if (await _IsRevoked(authenticationData)) return next(new Error("Unauthorized"))

            request.authenticationData = authenticationData
            next()
        }catch(e){
            next(e)
        }
    }

    onReady()
    return {
        GetMiddleware,
        GetWebSocketMiddleware
    }
}

module.exports = JWTVerifierMiddlewareService
