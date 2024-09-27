const express  = require("express")

const StaticEndpointsService = ({path, staticDir}) => {

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

module.exports = StaticEndpointsService