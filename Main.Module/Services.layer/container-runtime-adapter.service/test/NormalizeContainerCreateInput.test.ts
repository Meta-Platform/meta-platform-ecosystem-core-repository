const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")

const {
    NormalizeMounts,
    NormalizePorts,
    ResolveGroupAdd
} = require("../src/Helpers/NormalizeContainerCreateInput")

/* ---------------------------------------------------------------- montagens */

test("a forma do Docker (Type/Source/Target) monta o volume", () => {
    // Era exatamente esta forma que o formulário enviava e o adaptador
    // descartava em silêncio: o container nascia sem volume nenhum.
    const montagens = NormalizeMounts([{ Type: "volume", Source: "meus-dados", Target: "/data" }])

    assert.deepEqual(montagens, [{
        Type: "volume",
        Source: "meus-dados",
        Target: "/data",
        ReadOnly: false
    }])
})

test("a forma canônica em minúsculas monta o volume", () => {
    const montagens = NormalizeMounts([{ type: "volume", source: "meus-dados", target: "/data" }])
    assert.equal(montagens[0].Source, "meus-dados")
})

test("o legado volumeName continua funcionando", () => {
    const montagens = NormalizeMounts([{ volumeName: "meus-dados", target: "/data" }])

    assert.deepEqual(montagens, [{
        Type: "volume",
        Source: "meus-dados",
        Target: "/data",
        ReadOnly: false
    }])
})

test("o legado hostPath vira bind mount", () => {
    const montagens = NormalizeMounts([{ hostPath: "/var/run/docker.sock", target: "/var/run/docker.sock" }])

    assert.equal(montagens[0].Type, "bind")
    assert.deepEqual(montagens[0].BindOptions, { CreateMountpoint: true })
})

test("somente leitura é respeitado nas duas grafias", () => {
    const [porBaixo] = NormalizeMounts([{ type: "volume", source: "v", target: "/d", readOnly: true }])
    const [porCima] = NormalizeMounts([{ Type: "volume", Source: "v", Target: "/d", ReadOnly: true }])

    assert.equal(porBaixo.ReadOnly, true)
    assert.equal(porCima.ReadOnly, true)
})

test("tmpfs não exige origem e aceita tamanho", () => {
    const [montagem] = NormalizeMounts([{ type: "tmpfs", target: "/tmp", sizeBytes: 67108864 }])

    assert.equal(montagem.Type, "tmpfs")
    assert.equal(montagem.Source, undefined)
    assert.deepEqual(montagem.TmpfsOptions, { SizeBytes: 67108864 })
})

test("montagem sem destino é RECUSADA, nomeando o campo", () => {
    assert.throws(
        () => NormalizeMounts([{ type: "volume", source: "v" }]),
        (erro: any) => erro.code === "INVALID_MOUNT" && erro.field === "mounts[0].target"
    )
})

test("montagem sem origem é RECUSADA, nomeando o campo", () => {
    assert.throws(
        () => NormalizeMounts([{ type: "volume", target: "/data" }]),
        (erro: any) => erro.code === "INVALID_MOUNT" && erro.field === "mounts[0].source"
    )
})

test("tipo desconhecido é RECUSADO em vez de descartado", () => {
    // O comportamento antigo — filtrar o que não reconhece — fazia a criação
    // parecer bem-sucedida com o dado do usuário jogado fora.
    assert.throws(
        () => NormalizeMounts([{ type: "nfs", source: "x", target: "/data" }]),
        (erro: any) => erro.code === "INVALID_MOUNT" && erro.field === "mounts[0].type"
    )
})

test("bind mount com caminho relativo é recusado", () => {
    assert.throws(
        () => NormalizeMounts([{ type: "bind", source: "dados", target: "/data" }]),
        (erro: any) => erro.code === "INVALID_MOUNT" && erro.field === "mounts[0].source"
    )
})

test("erro de entrada sai como 400, não como falha do runtime", () => {
    // Sem statusCode, o servidor responde 500 e a tela diz "erro interno"
    // para o que é um campo preenchido errado.
    assert.throws(
        () => NormalizeMounts([{ type: "volume", source: "v" }]),
        (erro: any) => erro.statusCode === 400 && erro.httpStatus === 400
    )
    assert.throws(
        () => NormalizePorts([{ hostPort: 8080 }]),
        (erro: any) => erro.statusCode === 400
    )
})

test("lista vazia e ausente produzem nenhuma montagem", () => {
    assert.deepEqual(NormalizeMounts([]), [])
    assert.deepEqual(NormalizeMounts(), [])
})

/* ------------------------------------------------------------------ portas */

test("porta publicada gera exposição e vínculo", () => {
    const { exposedPorts, portBindings } = NormalizePorts([{ containerPort: 80, hostPort: 8080 }])

    assert.deepEqual(exposedPorts, { "80/tcp": {} })
    assert.deepEqual(portBindings, { "80/tcp": [{ HostPort: "8080" }] })
})

test("porta SEM host expõe e não publica, em vez de quebrar", () => {
    // hostPort.toString() sem checagem lançava TypeError aqui.
    const { exposedPorts, portBindings } = NormalizePorts([{ containerPort: 5432 }])

    assert.deepEqual(exposedPorts, { "5432/tcp": {} })
    assert.deepEqual(portBindings, {})
})

test("hostPort vazio conta como não publicada", () => {
    const { portBindings } = NormalizePorts([{ containerPort: 5432, hostPort: "" }])
    assert.deepEqual(portBindings, {})
})

test("UDP é possível de pedir", () => {
    const { exposedPorts, portBindings } = NormalizePorts([
        { containerPort: 53, hostPort: 53, protocol: "udp" }
    ])

    assert.deepEqual(exposedPorts, { "53/udp": {} })
    assert.equal(portBindings["53/udp"][0].HostPort, "53")
})

test("publicar em um IP específico do host", () => {
    const { portBindings } = NormalizePorts([
        { containerPort: 80, hostPort: 8080, hostIp: "127.0.0.1" }
    ])

    assert.deepEqual(portBindings["80/tcp"], [{ HostPort: "8080", HostIp: "127.0.0.1" }])
})

test("porta sem containerPort é recusada nomeando o campo", () => {
    assert.throws(
        () => NormalizePorts([{ hostPort: 8080 }]),
        (erro: any) => erro.code === "INVALID_PORT" && erro.field === "ports[0].containerPort"
    )
})

test("protocolo desconhecido é recusado", () => {
    assert.throws(
        () => NormalizePorts([{ containerPort: 80, protocol: "icmp" }]),
        (erro: any) => erro.code === "INVALID_PORT" && erro.field === "ports[0].protocol"
    )
})

/* ------------------------------------------------------- grupos do host */

test("por padrão o container NÃO herda os grupos do processo", () => {
    assert.deepEqual(ResolveGroupAdd({}), [])
    assert.deepEqual(ResolveGroupAdd(), [])
})

test("inheritHostGroups reproduz o comportamento antigo", () => {
    const grupos = ResolveGroupAdd({ inheritHostGroups: true })
    const esperados = typeof process.getgroups === "function"
        ? process.getgroups().map(String)
        : []

    assert.deepEqual(grupos, esperados)
})

test("groupAdd explícito vence a herança", () => {
    assert.deepEqual(ResolveGroupAdd({ groupAdd: [999], inheritHostGroups: true }), ["999"])
})
