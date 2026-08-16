const express  = require("express") as any

const CreateStaticEndpointsService = ({path, staticDir}: { path: string, staticDir: string, needsAuth?: boolean }) => {

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