const http = require('http')

const FetchServerAndServiceStatus = async ({
    serverResourceEndpointPath,
    mainApplicationSocketPath
}) => {
    
    const agent = new http.Agent({ socketPath: mainApplicationSocketPath})
    const url = `http://localhost${serverResourceEndpointPath}`
    const options = {
        agent,
        method: 'GET'
    }

    const response = await fetch(url, options)
    if (!response.ok) {
        throw response
    }
    const data = await response.json()
    return data
}

module.exports = FetchServerAndServiceStatus
