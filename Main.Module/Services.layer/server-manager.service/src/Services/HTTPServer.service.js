const express       = require("express")
const cors          = require("cors")
const bodyParser    = require("body-parser")
const expressWs     = require("express-ws")
const fs = require("fs")

const CreateAPIEndpointsService    = require("../Helpers/CreateAPIEndpointsService")
const CreateStaticEndpointsService = require("../Helpers/CreateStaticEndpointsService")

const HTTPServerService = (params) => {

    const serviceList = []

    const {
        name, 
        port,
        onReady,
        onClose
    } = params

    const app = express()
    expressWs(app)

    app.use(cors())
    app.use(bodyParser.json())

    let server = {}

    if (isNaN(parseInt(port, 10))) {
        if (fs.existsSync(port)) fs.unlinkSync(port)
        server = app.listen(port, () => onReady())
    } else {
        server = app.listen(port, onReady)
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
            needsAuth
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