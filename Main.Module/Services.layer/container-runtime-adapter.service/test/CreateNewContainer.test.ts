/*
    O JSON que sai daqui vai direto para a API do runtime. Este teste monta o
    manager com um cliente DUPLO (CTMG-29) e afirma o objeto exato — sem
    daemon, sem container, sem rede.

    O caso mais importante é o de REGRESSÃO: o `service-orchestrator` do
    VirtualDeskRepo chama `CreateNewContainer` com o vocabulário antigo, e o
    provisionamento da nuvem depende de ele continuar produzindo o mesmo JSON.
*/
const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")

const CriarManagerDuplo = () => {
    const chamadas: any[] = []

    const clienteFalso = {
        createContainer: async (options: any) => {
            chamadas.push(options)
            return { inspect: async () => ({ Id: "fake", Options: options }) }
        },
        // O manager abre o stream de eventos na construção; o duplo o ignora.
        getEvents: () => {}
    }

    const manager = ContainerManager({
        socketPath: "/tmp/irrelevante.sock",
        CreateClient: () => clienteFalso
    })

    return { manager, chamadas }
}

test("volume pedido pela tela chega ao runtime", async () => {
    const { manager, chamadas } = CriarManagerDuplo()

    await manager.CreateNewContainer({
        imageName: "postgres:16",
        containerName: "meu-postgres",
        mounts: [{ Type: "volume", Source: "pgdata", Target: "/var/lib/postgresql/data" }]
    })

    assert.deepEqual(chamadas[0].HostConfig.Mounts, [{
        Type: "volume",
        Source: "pgdata",
        Target: "/var/lib/postgresql/data",
        ReadOnly: false
    }])
})

test("porta exposta sem publicar não quebra e não vira vínculo", async () => {
    const { manager, chamadas } = CriarManagerDuplo()

    await manager.CreateNewContainer({
        imageName: "postgres:16",
        ports: [{ containerPort: 5432 }]
    })

    assert.deepEqual(chamadas[0].ExposedPorts, { "5432/tcp": {} })
    assert.deepEqual(chamadas[0].HostConfig.PortBindings, {})
})

test("o container não herda mais os grupos do processo do adaptador", async () => {
    const { manager, chamadas } = CriarManagerDuplo()

    await manager.CreateNewContainer({ imageName: "alpine:latest" })

    assert.equal(chamadas[0].HostConfig.GroupAdd, undefined)
})

test("quem precisa dos grupos do host continua podendo pedi-los", async () => {
    const { manager, chamadas } = CriarManagerDuplo()

    await manager.CreateNewContainer({
        imageName: "alpine:latest",
        inheritHostGroups: true
    })

    assert.equal(Array.isArray(chamadas[0].HostConfig.GroupAdd), true)
})

test("REGRESSÃO: a chamada do service-orchestrator produz o mesmo JSON de antes", async () => {
    const { manager, chamadas } = CriarManagerDuplo()

    // Forma exata usada por ServiceHandler.create.js no VirtualDeskRepo.
    await manager.CreateNewContainer({
        imageName: "ecosystem_virtualdeskrepo:mydata-62-e38b5bb7",
        containerName: "container_mydata-234",
        networkmode: "ring1-platform",
        networkAliases: ["mydata"],
        ports: [{ containerPort: 7010, hostPort: 7010 }],
        mounts: [
            { volumeName: "mydata-a1b2-fotos", target: "/volume/mydata-a1b2-fotos" },
            { hostPath: "/var/run/docker.sock", target: "/var/run/docker.sock" }
        ],
        environment: { NODE_ENV: "production" },
        inheritHostGroups: true
    })

    const enviado = chamadas[0]

    assert.equal(enviado.Image, "ecosystem_virtualdeskrepo:mydata-62-e38b5bb7")
    assert.equal(enviado.name, "container_mydata-234")
    assert.deepEqual(enviado.Env, ["NODE_ENV=production"])
    assert.deepEqual(enviado.ExposedPorts, { "7010/tcp": {} })
    assert.deepEqual(enviado.HostConfig.PortBindings, { "7010/tcp": [{ HostPort: "7010" }] })
    assert.equal(enviado.HostConfig.NetworkMode, "ring1-platform")

    // Volume e bind preservados, com o bind mantendo CreateMountpoint.
    assert.equal(enviado.HostConfig.Mounts.length, 2)
    assert.equal(enviado.HostConfig.Mounts[0].Type, "volume")
    assert.equal(enviado.HostConfig.Mounts[0].Source, "mydata-a1b2-fotos")
    assert.equal(enviado.HostConfig.Mounts[1].Type, "bind")
    assert.deepEqual(enviado.HostConfig.Mounts[1].BindOptions, { CreateMountpoint: true })

    // Grupos do host preservados para quem monta o socket do runtime.
    assert.equal(Array.isArray(enviado.HostConfig.GroupAdd), true)

    // Alias de rede na rede nomeada.
    assert.deepEqual(
        enviado.NetworkingConfig.EndpointsConfig["ring1-platform"].Aliases,
        ["mydata"]
    )
})

test("montagem irreconhecível falha a criação em vez de sumir", async () => {
    const { manager, chamadas } = CriarManagerDuplo()

    await assert.rejects(
        () => manager.CreateNewContainer({
            imageName: "alpine:latest",
            mounts: [{ type: "nfs", source: "servidor:/export", target: "/data" }]
        }),
        (erro: any) => erro.code === "INVALID_MOUNT"
    )

    assert.equal(chamadas.length, 0, "nada foi enviado ao runtime")
})
