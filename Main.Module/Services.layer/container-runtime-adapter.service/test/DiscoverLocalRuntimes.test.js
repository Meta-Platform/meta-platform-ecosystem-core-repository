const test = require("node:test")
const assert = require("node:assert/strict")

const DiscoverLocalRuntimes = require("../src/Helpers/DiscoverLocalRuntimes")

const ArquivosExistentes = (lista) => (caminho) => lista.includes(caminho)

test("encontra o socket do Docker do sistema", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: ArquivosExistentes(["/var/run/docker.sock"]),
        env: {},
        uid: 1000
    })
    assert.equal(sugestoes.length, 1)
    assert.equal(sugestoes[0].runtimeType, "docker")
    assert.equal(sugestoes[0].endpoint, "unix:///var/run/docker.sock")
})

test("encontra o Podman rootless pelo XDG_RUNTIME_DIR", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: ArquivosExistentes(["/run/user/1000/podman/podman.sock"]),
        env: { XDG_RUNTIME_DIR: "/run/user/1000" },
        uid: 1000
    })
    assert.equal(sugestoes.length, 1)
    assert.equal(sugestoes[0].runtimeType, "podman")
})

test("sem XDG_RUNTIME_DIR, cai no uid do processo", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: ArquivosExistentes(["/run/user/1001/podman/podman.sock"]),
        env: {},
        uid: 1001
    })
    assert.equal(sugestoes.length, 1)
    assert.equal(sugestoes[0].endpoint, "unix:///run/user/1001/podman/podman.sock")
})

test("Docker e Podman convivem: os dois aparecem", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: ArquivosExistentes([
            "/var/run/docker.sock",
            "/run/user/1000/podman/podman.sock"
        ]),
        env: { XDG_RUNTIME_DIR: "/run/user/1000" },
        uid: 1000
    })
    assert.equal(sugestoes.length, 2)
    assert.deepEqual(
        sugestoes.map((s) => s.runtimeType).sort(),
        ["docker", "podman"]
    )
})

test("DOCKER_HOST vira sugestão mesmo sem nada no disco", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: () => false,
        env: { DOCKER_HOST: "tcp://10.0.0.5:2375" },
        uid: 1000
    })
    assert.equal(sugestoes.length, 1)
    assert.equal(sugestoes[0].endpoint, "tcp://10.0.0.5:2375")
    assert.equal(sugestoes[0].source, "environment")
})

test("DOCKER_HOST apontando para socket do Podman é rotulado como podman", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: () => false,
        env: { DOCKER_HOST: "unix:///run/user/1000/podman/podman.sock" },
        uid: 1000
    })
    assert.equal(sugestoes[0].runtimeType, "podman")
})

test("o mesmo endereço não aparece duas vezes", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: ArquivosExistentes(["/var/run/docker.sock"]),
        env: { DOCKER_HOST: "unix:///var/run/docker.sock" },
        uid: 1000
    })
    assert.equal(sugestoes.length, 1)
})

test("máquina sem runtime nenhum devolve lista vazia, não erro", () => {
    const sugestoes = DiscoverLocalRuntimes({
        fileExists: () => false,
        env: {},
        uid: 1000
    })
    assert.deepEqual(sugestoes, [])
})
