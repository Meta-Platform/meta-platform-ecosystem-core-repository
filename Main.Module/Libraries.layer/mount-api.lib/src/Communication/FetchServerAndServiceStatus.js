const http = require('http')

const FetchServerAndServiceStatus = async ({
    serverResourceEndpointPath,
    mainApplicationSocketPath
}) => new Promise((resolve, reject) => {
    
    const options = {
        socketPath: mainApplicationSocketPath,
        path: serverResourceEndpointPath,
        method: 'GET'
    }

    const req = http.request(options, (res) => {

        let data = ''
        res.on('data', (chunk) => {
            data += chunk
        })

        res.on('end', () => {

            if (res.statusCode >= 200 && res.statusCode < 300)
                resolve(JSON.parse(data))
            else
                reject(new Error(`HTTP status ${res.statusCode}: ${data}`))

        })

    })

    req.on('error', (err) => reject(err))

    req.end()
})

module.exports = FetchServerAndServiceStatus
