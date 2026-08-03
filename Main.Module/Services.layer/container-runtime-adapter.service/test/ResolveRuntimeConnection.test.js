const test = require("node:test")
const assert = require("node:assert/strict")

const {
    ResolveRuntimeConnection,
    IsSupportedRuntimeType,
    TCP_PORT_PADRAO,
    TLS_PORT_PADRAO
} = require("../src/Helpers/ResolveRuntimeConnection")

test("socket unix vira socketPath", () => {
    const resultado = ResolveRuntimeConnection("unix:///var/run/docker.sock")
    assert.equal(resultado.valid, true)
    assert.equal(resultado.transport, "unix")
    assert.deepEqual(resultado.clientOptions, { socketPath: "/var/run/docker.sock" })
})

test("socket do Podman rootless é aceito como qualquer outro socket", () => {
    const resultado = ResolveRuntimeConnection("unix:///run/user/1000/podman/podman.sock")
    assert.equal(resultado.valid, true)
    assert.equal(resultado.socketPath, "/run/user/1000/podman/podman.sock")
})

test("tcp sem porta assume a porta padrão em texto claro", () => {
    const resultado = ResolveRuntimeConnection("tcp://10.0.0.5")
    assert.equal(resultado.valid, true)
    assert.equal(resultado.port, TCP_PORT_PADRAO)
    assert.equal(resultado.clientOptions.protocol, "http")
})

test("tcp com porta explícita respeita a porta", () => {
    const resultado = ResolveRuntimeConnection("tcp://10.0.0.5:2380")
    assert.equal(resultado.valid, true)
    assert.equal(resultado.host, "10.0.0.5")
    assert.equal(resultado.port, 2380)
})

test("https assume a porta TLS e marca a conexão como segura", () => {
    const resultado = ResolveRuntimeConnection("https://runtime.interno")
    assert.equal(resultado.valid, true)
    assert.equal(resultado.port, TLS_PORT_PADRAO)
    assert.equal(resultado.secure, true)
    assert.equal(resultado.clientOptions.protocol, "https")
})

test("material de TLS torna a conexão segura mesmo em tcp:// e é repassado", () => {
    const resultado = ResolveRuntimeConnection("tcp://runtime.interno:2376", {
        tls: { ca: "CA", cert: "CERT", key: "KEY" }
    })
    assert.equal(resultado.secure, true)
    assert.equal(resultado.clientOptions.protocol, "https")
    assert.equal(resultado.clientOptions.ca, "CA")
    assert.equal(resultado.clientOptions.cert, "CERT")
    assert.equal(resultado.clientOptions.key, "KEY")
})

test("endereço sem esquema é recusado, não adivinhado", () => {
    // Adivinhar entre tcp e https escolheria por conta própria se o tráfego
    // vai em texto claro — é exatamente o que não pode acontecer.
    const resultado = ResolveRuntimeConnection("10.0.0.5:2375")
    assert.equal(resultado.valid, false)
    assert.equal(resultado.reason, "SCHEME_REQUIRED")
})

test("socket unix relativo é recusado", () => {
    const resultado = ResolveRuntimeConnection("unix://var/run/docker.sock")
    assert.equal(resultado.valid, false)
    assert.equal(resultado.reason, "SOCKET_PATH_MUST_BE_ABSOLUTE")
})

test("esquema desconhecido é recusado", () => {
    const resultado = ResolveRuntimeConnection("ssh://maquina/podman.sock")
    assert.equal(resultado.valid, false)
    assert.equal(resultado.reason, "UNSUPPORTED_SCHEME")
})

test("porta não numérica e porta fora de faixa são recusadas", () => {
    assert.equal(ResolveRuntimeConnection("tcp://host:abc").reason, "INVALID_PORT")
    assert.equal(ResolveRuntimeConnection("tcp://host:70000").reason, "INVALID_PORT")
    assert.equal(ResolveRuntimeConnection("tcp://host:0").reason, "INVALID_PORT")
})

test("endpoint vazio ou ausente é recusado", () => {
    assert.equal(ResolveRuntimeConnection("").reason, "ENDPOINT_REQUIRED")
    assert.equal(ResolveRuntimeConnection(undefined).reason, "ENDPOINT_REQUIRED")
    assert.equal(ResolveRuntimeConnection("   ").reason, "ENDPOINT_REQUIRED")
})

test("só docker e podman são tipos de runtime aceitos", () => {
    assert.equal(IsSupportedRuntimeType("docker"), true)
    assert.equal(IsSupportedRuntimeType("Podman"), true)
    assert.equal(IsSupportedRuntimeType("containerd"), false)
    assert.equal(IsSupportedRuntimeType(undefined), false)
})
