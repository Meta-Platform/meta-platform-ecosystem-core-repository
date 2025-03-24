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

const JWTAuthenticationService = (params) => {

    const {
        secretKey,
        onReady
    } = params

    const GetMiddleware = () => (request, response, next) => {
        try{
            const token = ExtractTokenByRequest(request)
            request.authenticationData = jwt.verify(token, secretKey)
            next()
        }catch(e){
            response.status(401).json({ 
                error: 'Unauthorized'
            })
        }
    }
    onReady()
    return {
        GetMiddleware
    }
}

module.exports = JWTAuthenticationService