const express  = require("express")

const CreateStaticEndpointsService = ({path, staticDir}) => {

    const router = express.Router()
    router.use(path, express.static(staticDir))

    return {
        GetData: () => {
            return {
                serviceName: "StaticEndpointsService",
                path,
                staticDir
            }
        },
        GetRoute: () => router
    }
}

module.exports = CreateStaticEndpointsService