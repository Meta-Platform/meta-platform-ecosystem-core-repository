const { promisify } = require("util") as typeof import("util")
const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

const readdir   = promisify(fs.readdir)
const readFile  = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir     = promisify(fs.mkdir)

const API_FILE_SUFFIX = ".api.json"

/** Um endpoint como fica gravado no `<name>.api.json`. */
type Endpoint = {
    summary: string
    method: string
    path?: string
    parameters?: unknown[]
    [field: string]: unknown
}

type ApiDocument = {
    name: string
    endpoints: Endpoint[]
}

/**
 * Núcleo compartilhado de autoria de APIs (edição visual de pacotes .webservice).
 *
 * Cada API é um arquivo `<name>.api.json` em `apisDir` no formato
 * `{ name, endpoints: [{ summary, method, path, parameters }] }`.
 *
 * Persistência = fs puro (sem lowdb). Reutilizável por api-designer.webservice
 * e por CLI.
 */
const InitializeApiAuthoring = (apisDir: string) => {

    const _apiFilePath = (api: string) => path.resolve(apisDir, `${api}${API_FILE_SUFFIX}`)

    const _readAPI = async (api: string): Promise<ApiDocument> => JSON.parse(await readFile(_apiFilePath(api), "utf-8"))

    const _writeAPI = async (api: string, data: ApiDocument) => {
        await mkdir(apisDir, { recursive: true })
        return writeFile(_apiFilePath(api), JSON.stringify(data, null, 4), "utf-8")
    }

    const ListAPIs = async (): Promise<string[]> => {
        try{
            return (await readdir(apisDir))
            .filter((filename) => filename.endsWith(API_FILE_SUFFIX))
            .map((filename) => filename.slice(0, -API_FILE_SUFFIX.length))
        }catch(e: any){
            if(e.code === "ENOENT") return []
            throw e
        }
    }

    const GetAPI = (api: string) => _readAPI(api)

    const ListEndpoints = async (api: string) => (await _readAPI(api)).endpoints

    const CreateAPI = async (name: string) => {
        await _writeAPI(name, { name, endpoints: [] })
        return { message: "API successfully created" }
    }

    const CreateEndpoint = async ({ api, endpoint, method }: { api: string, endpoint: string, method: string }) => {
        const data = await _readAPI(api)
        if(data.endpoints.some((e) => e.summary === endpoint))
            throw { message: "endpoint already exists" }
        data.endpoints.push({ summary: endpoint, method })
        await _writeAPI(api, data)
        return { message: "endpoint successfully created" }
    }

    const _updateEndpointField = async (api: string, endpoint: string, field: string, value: unknown) => {
        const data = await _readAPI(api)
        const target = data.endpoints.find((e) => e.summary === endpoint)
        if(!target) throw { message: `endpoint "${endpoint}" not found` }
        target[field] = value
        await _writeAPI(api, data)
        return { message: `${field} successfully updated` }
    }

    const UpdatePath = ({ api, endpoint, path }: { api: string, endpoint: string, path: string }) =>
        _updateEndpointField(api, endpoint, "path", path)

    const UpdateMethod = ({ api, endpoint, method }: { api: string, endpoint: string, method: string }) =>
        _updateEndpointField(api, endpoint, "method", method)

    const UpdateParameters = ({ api, endpoint, parameters }: { api: string, endpoint: string, parameters: unknown[] }) =>
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
