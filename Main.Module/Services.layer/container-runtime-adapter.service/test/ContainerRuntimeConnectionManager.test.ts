const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")
const { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } = require("node:fs") as typeof import("node:fs")
const { join } = require("node:path") as typeof import("node:path")
const { tmpdir } = require("node:os") as typeof import("node:os")

const ContainerRuntimeConnectionManager = require("../src/Managers/ContainerRuntimeConnection.manager")

const CriarDiretorio = () => mkdtempSync(join(tmpdir(), "ctmg-conexoes-"))

/*
    O gerenciador é montado sempre com dublês: nem adaptador real nem cliente
    real. O que se testa aqui é o CONTRATO — cadastro, validação, cache e
    descarte —, e ele não pode depender de haver Docker na máquina do teste.
*/
const MontarGerenciador = ({
    storageDir,
    versionPorEndpoint = {},
    runtimesDescobertos = []
}: any = {}) => {
    const adaptadoresCriados: any[] = []
    let contador = 0

    const gerenciador = ContainerRuntimeConnectionManager({
        storageDir,
        GenerateId: () => `id-${++contador}`,
        Now: () => "2026-08-03T00:00:00.000Z",
        CreateAdapter: (clientOptions: any, conexao: any) => {
            const adaptador = { clientOptions, connectionId: conexao.id }
            adaptadoresCriados.push(adaptador)
            return adaptador
        },
        CreateProbeClient: (clientOptions: any) => ({
            version: async () => {
                const chave = clientOptions.socketPath
                    || `${clientOptions.host}:${clientOptions.port}`
                const resposta = versionPorEndpoint[chave]
                if (!resposta) throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
                return resposta
            }
        }),
        DiscoverRuntimes: () => runtimesDescobertos
    })

    return { gerenciador, adaptadoresCriados }
}

const VERSAO_DOCKER = { Version: "27.1.1", ApiVersion: "1.46", Os: "linux", Arch: "amd64" }
const VERSAO_PODMAN = {
    Version: "5.1.0",
    ApiVersion: "1.41",
    Os: "linux",
    Arch: "amd64",
    Components: [{ Name: "Podman Engine", Version: "5.1.0" }]
}

test("cadastra, lista e recupera uma conexão", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })

    const criada = gerenciador.CreateConnection({
        name: "docker-local",
        runtimeType: "docker",
        endpoint: "unix:///var/run/docker.sock"
    })

    assert.equal(criada.id, "id-1")
    assert.equal(criada.transport, "unix")
    assert.equal(gerenciador.ListConnections().length, 1)
    assert.equal(gerenciador.GetConnection("id-1").name, "docker-local")
})

test("Docker e Podman convivem como conexões independentes", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })
    gerenciador.CreateConnection({ name: "podman", runtimeType: "podman", endpoint: "unix:///run/user/1000/podman/podman.sock" })

    const lista = gerenciador.ListConnections()
    assert.equal(lista.length, 2)
    assert.deepEqual(lista.map((c: any) => c.runtimeType).sort(), ["docker", "podman"])
})

test("nome repetido é recusado, com ou sem diferença de maiúsculas", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "local", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })

    assert.throws(
        () => gerenciador.CreateConnection({ name: "LOCAL", runtimeType: "docker", endpoint: "tcp://outro:2375" }),
        (erro: any) => erro.code === "NAME_ALREADY_USED"
    )
})

test("endpoint inválido e runtime não suportado não entram no cadastro", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })

    assert.throws(
        () => gerenciador.CreateConnection({ name: "a", runtimeType: "docker", endpoint: "10.0.0.5:2375" }),
        (erro: any) => erro.code === "SCHEME_REQUIRED"
    )
    assert.throws(
        () => gerenciador.CreateConnection({ name: "b", runtimeType: "containerd", endpoint: "unix:///x.sock" }),
        (erro: any) => erro.code === "UNSUPPORTED_RUNTIME_TYPE"
    )
    assert.equal(gerenciador.ListConnections().length, 0)
})

test("os perfis sobrevivem ao reinício da instância", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const primeiro = MontarGerenciador({ storageDir: dir }).gerenciador
    primeiro.CreateConnection({ name: "docker-local", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })

    const segundo = MontarGerenciador({ storageDir: dir }).gerenciador
    const lista = segundo.ListConnections()
    assert.equal(lista.length, 1)
    assert.equal(lista[0].name, "docker-local")
})

test("material de TLS é guardado mas nunca sai na listagem", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })
    const criada = gerenciador.CreateConnection({
        name: "remoto",
        runtimeType: "docker",
        endpoint: "tcp://10.0.0.5:2376",
        tls: { ca: "CA", cert: "CERT", key: "CHAVE-PRIVADA" }
    })

    assert.equal(criada.hasTLS, true)
    assert.equal(criada.tls, undefined)
    assert.equal(JSON.stringify(gerenciador.ListConnections()).includes("CHAVE-PRIVADA"), false)

    // Guardado, sim: sem isso a conexão não se refaz depois do reinício.
    const persistido = readFileSync(gerenciador.GetStoreFilePath(), "utf8")
    assert.equal(persistido.includes("CHAVE-PRIVADA"), true)
})

test("o adaptador é criado sob demanda e reaproveitado", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador, adaptadoresCriados } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })

    assert.equal(adaptadoresCriados.length, 0, "cadastrar não conecta")

    const primeiro = gerenciador.GetAdapter("id-1")
    const segundo = gerenciador.GetAdapter("id-1")

    assert.equal(adaptadoresCriados.length, 1)
    assert.equal(primeiro, segundo)
    assert.deepEqual(primeiro.clientOptions, { socketPath: "/var/run/docker.sock" })
})

test("editar o endpoint descarta o adaptador que apontava para o endereço antigo", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador, adaptadoresCriados } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })
    gerenciador.GetAdapter("id-1")

    gerenciador.UpdateConnection("id-1", { endpoint: "tcp://10.0.0.9:2375" })
    const novo = gerenciador.GetAdapter("id-1")

    assert.equal(adaptadoresCriados.length, 2, "um adaptador novo, para o endereço novo")
    assert.deepEqual(novo.clientOptions, { host: "10.0.0.9", port: 2375, protocol: "http" })
})

test("remover a conexão a tira da lista e do cache", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })
    gerenciador.GetAdapter("id-1")

    gerenciador.RemoveConnection("id-1")

    assert.deepEqual(gerenciador.ListConnections(), [])
    assert.throws(() => gerenciador.GetAdapter("id-1"), (erro: any) => erro.code === "CONNECTION_NOT_FOUND")
})

test("teste de conexão informa versão e reconhece o Podman pelo que ele responde", async (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({
        storageDir: dir,
        versionPorEndpoint: {
            "/var/run/docker.sock": VERSAO_DOCKER,
            "/run/user/1000/podman/podman.sock": VERSAO_PODMAN
        }
    })

    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })
    gerenciador.CreateConnection({ name: "podman", runtimeType: "podman", endpoint: "unix:///run/user/1000/podman/podman.sock" })

    const docker = await gerenciador.TestConnection("id-1")
    assert.equal(docker.reachable, true)
    assert.equal(docker.runtimeType, "docker")
    assert.equal(docker.version, "27.1.1")

    const podman = await gerenciador.TestConnection("id-2")
    assert.equal(podman.reachable, true)
    assert.equal(podman.runtimeType, "podman")
})

test("perfil rotulado errado é sinalizado, não corrigido em silêncio", async (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({
        storageDir: dir,
        versionPorEndpoint: { "/run/user/1000/podman/podman.sock": VERSAO_PODMAN }
    })
    gerenciador.CreateConnection({
        name: "que-eu-achei-que-era-docker",
        runtimeType: "docker",
        endpoint: "unix:///run/user/1000/podman/podman.sock"
    })

    const resultado = await gerenciador.TestConnection("id-1")
    assert.equal(resultado.runtimeType, "podman")
    assert.equal(resultado.declaredRuntimeType, "docker")
    assert.equal(resultado.runtimeTypeMatches, false)
})

test("runtime fora do ar é resposta, não exceção", async (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "morto", runtimeType: "docker", endpoint: "tcp://10.0.0.5:2375" })

    const resultado = await gerenciador.TestConnection("id-1")
    assert.equal(resultado.reachable, false)
    assert.equal(resultado.code, "ECONNREFUSED")
})

test("descoberta marca o que já está cadastrado", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({
        storageDir: dir,
        runtimesDescobertos: [
            { runtimeType: "docker", suggestedName: "docker-local", endpoint: "unix:///var/run/docker.sock", source: "filesystem" },
            { runtimeType: "podman", suggestedName: "podman-usuario", endpoint: "unix:///run/user/1000/podman/podman.sock", source: "filesystem" }
        ]
    })
    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })

    const descobertas = gerenciador.DiscoverConnections()
    assert.equal(descobertas.find((d: any) => d.runtimeType === "docker").alreadyRegistered, true)
    assert.equal(descobertas.find((d: any) => d.runtimeType === "podman").alreadyRegistered, false)
})

test("arquivo de conexões corrompido não é tratado como lista vazia", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    // Tratar corrompido como vazio faria a próxima gravação apagar tudo.
    writeFileSync(join(dir, "container-connections.json"), "{ isto não é json", "utf8")

    assert.throws(() => MontarGerenciador({ storageDir: dir }), /ilegível/)
})

test("o arquivo de conexões nasce no diretório declarado, sem reinterpretação", (t) => {
    const dir = CriarDiretorio()
    t.after(() => rmSync(dir, { recursive: true, force: true }))

    const { gerenciador } = MontarGerenciador({ storageDir: dir })
    gerenciador.CreateConnection({ name: "docker", runtimeType: "docker", endpoint: "unix:///var/run/docker.sock" })

    assert.equal(gerenciador.GetStoreFilePath(), join(dir, "container-connections.json"))
    assert.equal(existsSync(join(dir, "container-connections.json")), true)
})
