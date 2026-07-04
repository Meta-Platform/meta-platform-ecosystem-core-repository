const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")

const readdir   = promisify(fs.readdir)
const readFile  = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir     = promisify(fs.mkdir)

const API_FILE_SUFFIX = ".api.json"

/**
 * Núcleo compartilhado de autoria de APIs (edição visual de pacotes .webservice).
 *
 * Cada API é um arquivo `<name>.api.json` em `apisDir` no formato
 * `{ name, endpoints: [{ summary, method, path, parameters }] }`.
 *
 * Persistência = fs puro (sem lowdb). Reutilizável por api-designer.webservice
 * e por CLI.
 */
const InitializeApiAuthoring = (apisDir) => {

    const _apiFilePath = (api) => path.resolve(apisDir, `${api}${API_FILE_SUFFIX}`)

    const _readAPI = async (api) => JSON.parse(await readFile(_apiFilePath(api), "utf-8"))

    const _writeAPI = async (api, data) => {
        await mkdir(apisDir, { recursive: true })
        return writeFile(_apiFilePath(api), JSON.stringify(data, null, 4), "utf-8")
    }

    const ListAPIs = async () => {
        try{
            return (await readdir(apisDir))
            .filter((filename) => filename.endsWith(API_FILE_SUFFIX))
            .map((filename) => filename.slice(0, -API_FILE_SUFFIX.length))
        }catch(e){
            if(e.code === "ENOENT") return []
            throw e
        }
    }

    const GetAPI = (api) => _readAPI(api)

    const ListEndpoints = async (api) => (await _readAPI(api)).endpoints

    const CreateAPI = async (name) => {
        await _writeAPI(name, { name, endpoints: [] })
        return { message: "API successfully created" }
    }

    const CreateEndpoint = async ({ api, endpoint, method }) => {
        const data = await _readAPI(api)
        if(data.endpoints.some((e) => e.summary === endpoint))
            throw { message: "endpoint already exists" }
        data.endpoints.push({ summary: endpoint, method })
        await _writeAPI(api, data)
        return { message: "endpoint successfully created" }
    }

    const _updateEndpointField = async (api, endpoint, field, value) => {
        const data = await _readAPI(api)
        const target = data.endpoints.find((e) => e.summary === endpoint)
        if(!target) throw { message: `endpoint "${endpoint}" not found` }
        target[field] = value
        await _writeAPI(api, data)
        return { message: `${field} successfully updated` }
    }

    const UpdatePath = ({ api, endpoint, path }) =>
        _updateEndpointField(api, endpoint, "path", path)

    const UpdateMethod = ({ api, endpoint, method }) =>
        _updateEndpointField(api, endpoint, "method", method)

    const UpdateParameters = ({ api, endpoint, parameters }) =>
        _updateEndpointField(api, endpoint, "parameters", parameters)

    return {
        ListAPIs,
        GetAPI,
        ListEndpoints,
        CreateAPI,
        CreateEndpoint,
        UpdatePath,
        UpdateMethod,
        UpdateParameters
    }
}

module.exports = InitializeApiAuthoring
