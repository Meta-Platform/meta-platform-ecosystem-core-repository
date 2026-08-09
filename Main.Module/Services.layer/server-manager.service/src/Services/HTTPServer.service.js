const http          = require("http")
const express       = require("express")
const cors          = require("cors")
const bodyParser    = require("body-parser")
const expressWs     = require("express-ws")
const cookieParser = require('cookie-parser')

const fs = require("fs")

const CreateAPIEndpointsService    = require("../Helpers/CreateAPIEndpointsService")
const CreateStaticEndpointsService = require("../Helpers/CreateStaticEndpointsService")

const HTTPServerService = (params) => {

    const serviceList = []

    const {
        name,
        port,
        onReady,
        onClose,
        onError,
        middlewareService
    } = params

    const app = express()

    /*
        TETO DO CORPO DA REQUISIÇÃO.

        `bodyParser.json()` sem argumento aplica o padrão da biblioteca: 100 KB.
        Isso é razoável para uma API de formulário e é pequeno demais para esta
        plataforma, onde CONTEÚDO DE ARQUIVO trafega dentro de JSON (o upload
        para espaço de dados manda o arquivo em base64, e o mesmo vale para os
        contratos entre painéis). Na prática, qualquer arquivo acima de ~70 KB
        era recusado com `PayloadTooLargeError: request entity too large` —
        antes de chegar ao controller, então sem mensagem útil e sem registro
        no log do serviço.

        O valor é configurável por parâmetro do serviço; o padrão generoso
        existe porque o custo de um teto baixo é uma funcionalidade que
        simplesmente não funciona, enquanto o custo de um teto alto é memória
        por requisição — que quem serve arquivo já paga de qualquer forma.

        Upload multipart NÃO passa por aqui (é tratado por multer, em disco);
        este limite governa só o que chega como JSON.
    */
    const jsonBodyLimit = params.jsonBodyLimit ?? "256mb"

    app.use(cors())
    app.use(bodyParser.json({ limit: jsonBodyLimit }))
    app.use(bodyParser.urlencoded({ limit: jsonBodyLimit, extended: true }))
    app.use(cookieParser())

    // Criamos o http.Server explicitamente (em vez de deixar app.listen criar) para
    // anexar o handler de 'error' ANTES do listen. Com express-ws, um erro de listen
    // (ex.: EADDRINUSE) é emitido de forma ASSÍNCRONA — escapa do try/catch de quem
    // chamou — e NÃO no objeto retornado por app.listen, mas no WebSocketServer
    // interno; por isso tratamos tanto o http.Server quanto o getWss(). Sem isso o
    // erro virava exceção não capturada e derrubava o processo em silêncio.
    const server = http.createServer(app)
    const wsInstance = expressWs(app, server)

    let errorReported = false
    const _HandleServerError = (err) => {
        // http.Server e WebSocketServer emitem o MESMO erro: reporta uma vez só.
        if (errorReported) return
        errorReported = true
        if (onError) onError(err)
    }
    server.on("error", _HandleServerError)
    wsInstance.getWss().on("error", _HandleServerError)

    if (isNaN(parseInt(port, 10))) {
        if (fs.existsSync(port)) fs.unlinkSync(port)
        server.listen(port, () => onReady())
    } else {
        server.listen(port, onReady)
    }

    const AddStaticEndpoint = ({path, staticDir, needsAuth}) => {
        const staticEndpointsService = CreateStaticEndpointsService({path, staticDir, needsAuth})
        serviceList.push(staticEndpointsService)
        app.use(staticEndpointsService.GetRoute())
    }

    const AddServiceEndpoint = ({path, apiTemplate, service, needsAuth}) => {
        const apiEndpointsService = CreateAPIEndpointsService({
            path,
            service, 
            apiTemplate,
            needsAuth,
            middlewareService
        })

        serviceList.push(apiEndpointsService)
        app.use(path, apiEndpointsService.GetRoute())
    }

    const Close = () => {
        server.close(() => {
            onClose()
        })
    }

    return {
        GetName: () => name,
        GetPort: () => port,
        ListServices: () => serviceList,
        AddStaticEndpoint,
        AddServiceEndpoint,
        Close
    }
}

module.exports = HTTPServerService