/*
    Gerenciador de CONEXÕES com runtimes de container (CTMG-8).

    O ContainerManager conhece um runtime só, fixado no boot pelo `socketPath`.
    Isso serve ao container-runtime-adapter.app, que é justamente a instância
    única dona de um socket. Não serve a um aplicativo de gestão, onde a
    pergunta é outra: "com QUAIS runtimes eu falo?" — Docker e Podman ao mesmo
    tempo, local e remoto ao mesmo tempo.

    Este gerenciador responde a essa pergunta SEM tocar no ContainerManager:
    guarda perfis de conexão e instancia um adaptador por perfil, sob demanda.
    Cada adaptador continua sendo o mesmo objeto de sempre, com a superfície
    completa — o que muda é quem decide para onde ele aponta, e quando.

    Três comportamentos que valem por si:

    1. O adaptador só nasce quando alguém pede (`GetAdapter`). Cadastrar uma
       conexão com um host fora do ar não pode travar o cadastro das outras.

    2. O adaptador vive em CACHE por conexão, e o cache é invalidado quando a
       conexão muda ou some. Sem isso, editar o endpoint deixaria um adaptador
       velho falando com o endereço antigo — e o pior erro possível é a
       operação funcionar no lugar errado.

    3. Material de TLS nunca sai em listagem. `ListConnections` devolve o
       perfil sem chave e sem certificado; quem precisa deles é a conexão, não
       a interface.
*/

const { randomUUID } = require("node:crypto")

const {
    ResolveRuntimeConnection,
    IsSupportedRuntimeType,
    RUNTIME_TYPES
} = require("../Helpers/ResolveRuntimeConnection")

const DiscoverLocalRuntimes = require("../Helpers/DiscoverLocalRuntimes")
const ContainerConnectionStore = require("../Stores/ContainerConnection.store")

/*
    O adaptador e o cliente do runtime são carregados AQUI, no topo, e não na
    hora de conectar.

    Isso não é preferência de estilo: o executor da plataforma aponta o
    NODE_PATH para as dependências do pacote apenas ENQUANTO o módulo é
    carregado, e o restaura em seguida. Um `require("dockerode")` tardio, feito
    no meio de uma chamada, procura num caminho que já não existe mais e falha
    com MODULE_NOT_FOUND — mesmo com a dependência instalada corretamente.

    O try/catch mantém o pacote utilizável onde o cliente do runtime não está
    instalado (o teste unitário roda assim): cadastrar, listar e apagar conexão
    é trabalho de arquivo e continua funcionando. Só CONECTAR fica indisponível,
    e com mensagem explícita em vez de um erro de resolução de módulo.
*/
let ContainerManager = null
let RuntimeClient = null
let ErroDeCarga = null

try {
    ContainerManager = require("./Container.manager")
    RuntimeClient = require("dockerode")
} catch (error) {
    ErroDeCarga = error
}

const ExigirClienteDeRuntime = () => {
    if (RuntimeClient && ContainerManager) return
    const erro = new Error(
        "O cliente do runtime de containers não está disponível neste processo " +
        `(${ErroDeCarga ? ErroDeCarga.message : "dockerode ausente"}). ` +
        "As conexões continuam podendo ser cadastradas, mas nenhuma pode ser usada."
    )
    erro.code = "RUNTIME_CLIENT_UNAVAILABLE"
    throw erro
}

const CriarErro = (code, message) => {
    const erro = new Error(message)
    erro.code = code
    return erro
}

/*
    Docker e Podman respondem ao mesmo /version, com conteúdo diferente: o
    Podman se anuncia nos componentes e no campo Platform. Preferir o que o
    runtime DIZ ser ao que o usuário cadastrou evita um perfil rotulado
    "docker" apontando para um Podman e ninguém entendendo o comportamento.
*/
const DetectarRuntime = (version) => {
    const texto = JSON.stringify(version || {}).toLowerCase()
    if (texto.includes("podman")) return "podman"
    if (texto.includes("docker")) return "docker"
    return null
}

const ContainerRuntimeConnectionManager = (params = {}) => {

    const {
        storageDir,
        connectionsFilePath,
        onReady,
        // Injetáveis para teste: sem eles, o caminho real é o dockerode.
        CreateAdapter = (connectionOptions) => {
            ExigirClienteDeRuntime()
            return ContainerManager({ connectionOptions })
        },
        CreateProbeClient,
        DiscoverRuntimes = DiscoverLocalRuntimes,
        GenerateId = randomUUID,
        Now = () => new Date().toISOString()
    } = params

    const store = ContainerConnectionStore({
        filePath: connectionsFilePath,
        storageDir
    })

    let conexoes = store.Load()
    const adaptadores = new Map()

    const Publico = ({ tls, ...conexao }) => ({
        ...conexao,
        hasTLS: Boolean(tls)
    })

    const Encontrar = (connectionId) =>
        conexoes.find((conexao) => conexao.id === connectionId)

    const ExigirConexao = (connectionId) => {
        const conexao = Encontrar(connectionId)
        if (!conexao) {
            throw CriarErro("CONNECTION_NOT_FOUND", `Conexão não encontrada: ${connectionId}`)
        }
        return conexao
    }

    const DescartarAdaptador = (connectionId) => {
        adaptadores.delete(connectionId)
    }

    const Validar = ({ name, runtimeType, endpoint, tls }, { ignorarId } = {}) => {
        const nome = typeof name === "string" ? name.trim() : ""
        if (nome === "") {
            throw CriarErro("NAME_REQUIRED", "A conexão precisa de um nome")
        }

        const nomeEmUso = conexoes.some((conexao) =>
            conexao.id !== ignorarId && conexao.name.toLowerCase() === nome.toLowerCase())
        if (nomeEmUso) {
            throw CriarErro("NAME_ALREADY_USED", `Já existe uma conexão chamada ${nome}`)
        }

        if (!IsSupportedRuntimeType(runtimeType)) {
            throw CriarErro(
                "UNSUPPORTED_RUNTIME_TYPE",
                `Tipo de runtime não suportado: ${runtimeType}. Use um de: ${RUNTIME_TYPES.join(", ")}`
            )
        }

        const resolucao = ResolveRuntimeConnection(endpoint, { tls })
        if (!resolucao.valid) {
            throw CriarErro(resolucao.reason, `Endpoint inválido (${resolucao.reason}): ${endpoint}`)
        }

        return {
            name: nome,
            runtimeType: String(runtimeType).toLowerCase(),
            endpoint: String(endpoint).trim(),
            resolucao
        }
    }

    const ListConnections = () => conexoes.map(Publico)

    const GetConnection = (connectionId) => Publico(ExigirConexao(connectionId))

    const CreateConnection = ({ name, runtimeType, endpoint, tls }) => {
        const validada = Validar({ name, runtimeType, endpoint, tls })

        const conexao = {
            id: GenerateId(),
            name: validada.name,
            runtimeType: validada.runtimeType,
            endpoint: validada.endpoint,
            transport: validada.resolucao.transport,
            createdAt: Now(),
            updatedAt: Now()
        }
        if (tls) conexao.tls = tls

        conexoes = store.Save([...conexoes, conexao])
        return Publico(conexao)
    }

    const UpdateConnection = (connectionId, patch = {}) => {
        const atual = ExigirConexao(connectionId)

        const proposta = {
            name: patch.name !== undefined ? patch.name : atual.name,
            runtimeType: patch.runtimeType !== undefined ? patch.runtimeType : atual.runtimeType,
            endpoint: patch.endpoint !== undefined ? patch.endpoint : atual.endpoint,
            tls: patch.tls !== undefined ? patch.tls : atual.tls
        }

        const validada = Validar(proposta, { ignorarId: connectionId })

        const atualizada = {
            ...atual,
            name: validada.name,
            runtimeType: validada.runtimeType,
            endpoint: validada.endpoint,
            transport: validada.resolucao.transport,
            updatedAt: Now()
        }
        if (proposta.tls) atualizada.tls = proposta.tls
        else delete atualizada.tls

        conexoes = store.Save(conexoes.map((conexao) =>
            conexao.id === connectionId ? atualizada : conexao))

        // O endereço pode ter mudado: o adaptador em cache aponta para o antigo.
        DescartarAdaptador(connectionId)

        return Publico(atualizada)
    }

    const RemoveConnection = (connectionId) => {
        ExigirConexao(connectionId)
        conexoes = store.Save(conexoes.filter((conexao) => conexao.id !== connectionId))
        DescartarAdaptador(connectionId)
        return { removed: connectionId }
    }

    /*
        Verifica se há alguém escutando do outro lado, e o que é esse alguém.
        Nunca lança: indisponibilidade é uma RESPOSTA aqui, não uma exceção —
        a interface precisa mostrar "offline" sem tratar erro a cada linha da
        lista.
    */
    const ProbeEndpoint = async ({ endpoint, runtimeType, tls }) => {
        const resolucao = ResolveRuntimeConnection(endpoint, { tls })
        if (!resolucao.valid) {
            return { reachable: false, code: resolucao.reason }
        }

        try {
            let cliente
            if (CreateProbeClient) {
                cliente = CreateProbeClient(resolucao.clientOptions)
            } else {
                ExigirClienteDeRuntime()
                cliente = new RuntimeClient(resolucao.clientOptions)
            }

            const version = await cliente.version()
            const detectado = DetectarRuntime(version)

            return {
                reachable: true,
                runtimeType: detectado || (runtimeType ? String(runtimeType).toLowerCase() : null),
                declaredRuntimeType: runtimeType ? String(runtimeType).toLowerCase() : null,
                runtimeTypeMatches: detectado && runtimeType
                    ? detectado === String(runtimeType).toLowerCase()
                    : null,
                version: version && version.Version ? version.Version : null,
                apiVersion: version && version.ApiVersion ? version.ApiVersion : null,
                os: version && version.Os ? version.Os : null,
                arch: version && version.Arch ? version.Arch : null
            }
        } catch (error) {
            return {
                reachable: false,
                code: error.code || "RUNTIME_UNREACHABLE",
                message: error.message
            }
        }
    }

    const TestConnection = async (connectionId) => {
        const conexao = ExigirConexao(connectionId)
        const resultado = await ProbeEndpoint({
            endpoint: conexao.endpoint,
            runtimeType: conexao.runtimeType,
            tls: conexao.tls
        })
        return { connectionId, ...resultado }
    }

    /*
        O adaptador da conexão, criado na primeira vez que alguém precisa dele
        e reaproveitado depois. É este objeto que expõe containers, imagens,
        redes e volumes — a superfície inteira do ContainerManager.
    */
    const GetAdapter = (connectionId) => {
        const conexao = ExigirConexao(connectionId)

        if (adaptadores.has(connectionId)) {
            return adaptadores.get(connectionId)
        }

        const resolucao = ResolveRuntimeConnection(conexao.endpoint, { tls: conexao.tls })
        if (!resolucao.valid) {
            throw CriarErro(resolucao.reason, `Endpoint inválido (${resolucao.reason}): ${conexao.endpoint}`)
        }

        const adaptador = CreateAdapter(resolucao.clientOptions, conexao)
        adaptadores.set(connectionId, adaptador)
        return adaptador
    }

    const DiscoverConnections = () => {
        const cadastradas = new Set(conexoes.map((conexao) => conexao.endpoint))
        return DiscoverRuntimes().map((sugestao) => ({
            ...sugestao,
            alreadyRegistered: cadastradas.has(sugestao.endpoint)
        }))
    }

    const GetStoreFilePath = () => store.GetFilePath()

    if (typeof onReady === "function") onReady()

    return Object.freeze({
        ListConnections,
        GetConnection,
        CreateConnection,
        UpdateConnection,
        RemoveConnection,
        TestConnection,
        ProbeEndpoint,
        GetAdapter,
        DiscoverConnections,
        GetStoreFilePath
    })
}

module.exports = ContainerRuntimeConnectionManager
