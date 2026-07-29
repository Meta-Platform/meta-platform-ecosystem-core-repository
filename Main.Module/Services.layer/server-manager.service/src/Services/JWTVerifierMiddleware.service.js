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
/*
    De quanto em quanto tempo uma conexão WebSocket JÁ ABERTA é reavaliada.

    Um minuto é o compromisso: curto o bastante para que "sair" signifique sair
    em tempo humano, e longo o bastante para que o custo de consultar o IAM seja
    desprezível ao lado do próprio tráfego do socket.

    `revocationRecheckIntervalMs` DE PROPÓSITO não está declarado no
    `metadata/services.json`: acrescentar parâmetro ao contrato deste serviço
    obriga toda imagem que carrega uma versão anterior deste pacote a conhecê-lo,
    e foi exatamente isso que derrubou os onze painéis (VDRP-247). O valor entra
    pelo default e é sobrescrevível em teste; expor a configuração é uma mudança
    de contrato, e como tal precisa ir junto com a publicação do core.
*/
const DEFAULT_REVOCATION_RECHECK_INTERVAL_MS = 60 * 1000

/* Faixa 4000-4999 é a reservada à aplicação pelo protocolo. */
const WS_CLOSE_CODE_SESSION_ENDED = 4401

const JWTVerifierMiddlewareService = (params) => {

    const {
        secretKey,
        tokenRevocationCheckerService,
        revocationRecheckIntervalMs = DEFAULT_REVOCATION_RECHECK_INTERVAL_MS,
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

    /*
        A AUTORIZAÇÃO DE UM SOCKET NÃO PODE SER DE UMA VEZ SÓ.

        Uma requisição HTTP é avaliada e termina; um WebSocket é avaliado na
        abertura e vive por horas. Recusar a abertura (acima) deixava de fora
        justamente a janela mais longa: quem fazia logout com um painel aberto
        continuava recebendo o fluxo — status de serviço, logs, métricas — até a
        conexão cair sozinha.

        Reavaliar de dentro da própria conexão evita ter de manter um registro
        global de sockets por token e um canal de invalidação do IAM para cada
        processo. O preço é a latência de até um intervalo entre revogar e
        derrubar, o que é aceitável para o que estes canais transportam.

        Fecha também quando o token EXPIRA: um socket que sobrevive ao próprio
        `exp` é a mesma falha, só que sem ninguém ter precisado deslogar.
    */
    const _WatchSessionOnOpenSocket = (ws, authenticationData) => {

        const _EndSession = () => {
            try {
                ws.close(WS_CLOSE_CODE_SESSION_ENDED, "session ended")
            } catch(e) {
                /* Já estava caindo: não há nada a fazer nem a registrar. */
            }
        }

        const _HasExpired = () =>
            typeof authenticationData?.exp === "number"
                && (authenticationData.exp * 1000) <= Date.now()

        const timer = setInterval(async () => {

            if (_HasExpired()) {
                clearInterval(timer)
                _EndSession()
                return
            }

            if (await _IsRevoked(authenticationData)) {
                clearInterval(timer)
                _EndSession()
            }

        }, revocationRecheckIntervalMs)

        /* O relógio de uma conexão não pode ser motivo para o processo continuar
         * vivo no encerramento do serviço. */
        if (typeof timer.unref === "function") timer.unref()

        const _StopWatching = () => clearInterval(timer)

        ws.on("close", _StopWatching)
        ws.on("error", _StopWatching)
    }

    const GetWebSocketMiddleware = () => async (ws, request, next) => {
        try{
            const token = ExtractTokenByRequest(request)
            const authenticationData = jwt.verify(token, secretKey)

            // O socket é aberto UMA vez e vive por horas — é o caminho onde um
            // token revogado sobrevive por mais tempo. Recusar a abertura é o
            // mínimo; a conexão aberta segue sendo reavaliada abaixo.
            if (await _IsRevoked(authenticationData)) return next(new Error("Unauthorized"))

            _WatchSessionOnOpenSocket(ws, authenticationData)

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
