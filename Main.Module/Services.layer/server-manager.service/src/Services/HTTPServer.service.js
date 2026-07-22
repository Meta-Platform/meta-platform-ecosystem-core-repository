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

    app.use(cors())
    app.use(bodyParser.json())
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