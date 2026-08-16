/*
    Recursos, processos, mudanças, commit, filtros e criar-e-subir
    (CTMG-38, 39, 41, 43, 49).

    O fio comum destes testes é a COMPATIBILIDADE: quase toda operação aqui
    ganhou parâmetros novos em funções que já tinham chamador — algumas em
    outro repositório. Chamada sem argumento tem de continuar fazendo o que
    fazia.
*/
const test = require("node:test")
const assert = require("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")
const BuildNetworkOptions = require("../src/Helpers/BuildNetworkOptions")
const { ParseByteSize, CpusToNanoCpus } = require("../src/Helpers/ParseByteSize")

const CriarAdaptador = ({ falharStart, logs, ...respostas } = {}) => {
    const registrado = { chamadas: [] }

    const cliente = {
        getEvents: () => {},
        listContainers: async (o) => { registrado.listContainers = o; return [] },
        listImages: async (o) => { registrado.listImages = o; return [] },
        listNetworks: async (o) => { registrado.listNetworks = o; return [] },
        listVolumes: async (o) => { registrado.listVolumes = o; return { Volumes: [] } },
        pruneNetworks: async (o) => { registrado.pruneNetworks = o; return { NetworksDeleted: ["n"] } },
        pruneVolumes: async (o) => { registrado.pruneVolumes = o; return { VolumesDeleted: ["v"], SpaceReclaimed: 9 } },
        createNetwork: async (o) => { registrado.createNetwork = o; return { id: "rede" } },
        createContainer: async (o) => {
            registrado.createContainer = o
            return { id: "novo", inspect: async () => ({ Id: "id-novo", Name: "/novo" }) }
        },
        getVolume: () => ({ remove: async (o) => registrado.chamadas.push(["volume.remove", o]) }),
        getImage: () => ({ inspect: async () => ({ Id: "sha256:imagem" }) }),
        getContainer: (nome) => ({
            start: async () => {
                registrado.chamadas.push(["start", nome])
                if (falharStart) throw new Error("porta 80 já está em uso")
            },
            inspect: async () => ({ Id: "id-novo", Name: "/novo", State: { Running: true } }),
            logs: async () => Buffer.from(logs ?? "", "utf-8"),
            update: async (o) => { registrado.update = o; return respostas.update ?? { Warnings: [] } },
            top: async (o) => { registrado.top = o; return respostas.top ?? { Titles: ["PID", "CMD"], Processes: [["1", "sh"]] } },
            changes: async () => respostas.changes ?? [{ Path: "/etc/hosts", Kind: 0 }, { Path: "/novo", Kind: 1 }, { Path: "/foi", Kind: 2 }],
            commit: async (o) => { registrado.commit = o; return { Id: "sha256:imagem" } }
        })
    }

    return {
        adaptador: ContainerManager({ socketPath: "/x", CreateClient: () => cliente }),
        registrado
    }
}

/* -------------------------------------------------- CTMG-41 · filtros */

test("as quatro listagens sem argumento continuam como antes", async () => {
    // O service-orchestrator do VirtualDeskRepo chama assim. Se `filters`
    // aparecesse como undefined na query, a listagem quebraria lá.
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.ListAllContainers()
    await adaptador.ListAllImages()
    await adaptador.ListAllNetworks()
    await adaptador.ListAllVolumes()

    assert.deepEqual(registrado.listContainers, { all: true })
    assert.deepEqual(registrado.listImages, {})
    assert.deepEqual(registrado.listNetworks, {})
    assert.deepEqual(registrado.listVolumes, {})
})

test("o filtro chega normalizado em lista nas quatro listagens", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.ListAllContainers({ filters: { status: "exited" } })
    await adaptador.ListAllImages({ filters: { dangling: true } })
    await adaptador.ListAllNetworks({ filters: { driver: "bridge" } })
    await adaptador.ListAllVolumes({ filters: { name: ["dados", "cache"] } })

    assert.deepEqual(registrado.listContainers.filters, { status: ["exited"] })
    assert.deepEqual(registrado.listImages.filters, { dangling: ["true"] })
    assert.deepEqual(registrado.listNetworks.filters, { driver: ["bridge"] })
    assert.deepEqual(registrado.listVolumes.filters, { name: ["dados", "cache"] })
})

test("listar containers só os em execução continua possível", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.ListAllContainers({ all: false })

    assert.equal(registrado.listContainers.all, false)
})

/* ------------------------------------------- CTMG-43 · criar e subir */

test("criar e subir devolve o container já em execução", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    const resultado = await adaptador.CreateAndStartContainer({
        imageName: "nginx", containerName: "web"
    })

    assert.equal(resultado.started, true)
    assert.equal(resultado.containerInfo.Id, "id-novo")
    assert.deepEqual(registrado.chamadas.filter(([o]) => o === "start"), [["start", "id-novo"]])
})

test("falha ao subir NÃO remove o container, e o erro carrega o log", async () => {
    /*
        Apagar o container após a falha destrói a única evidência do que deu
        errado. É exatamente por causa dessa evidência que se recorre ao
        terminal quando a interface não ajuda.
    */
    const { adaptador, registrado } = CriarAdaptador({
        falharStart: true,
        logs: "nginx: [emerg] bind() to 0.0.0.0:80 failed"
    })

    await assert.rejects(
        () => adaptador.CreateAndStartContainer({ imageName: "nginx", containerName: "web" }),
        (erro) =>
            erro.code === "CONTAINER_START_FAILED"
            && erro.containerId === "id-novo"
            && erro.logs.includes("bind() to 0.0.0.0:80 failed")
            && erro.message.includes("porta 80 já está em uso")
    )

    // Nenhuma remoção foi tentada.
    assert.equal(registrado.chamadas.some(([o]) => o === "remove"), false)
})

/* ------------------------------------- CTMG-38 · recursos em execução */

test("memória com sufixo vira bytes e cpus vira NanoCpus", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.UpdateContainerResources({
        containerIdOrName: "c",
        resources: { memoryBytes: "512m", cpus: 1.5, pidsLimit: 100 }
    })

    assert.equal(registrado.update.Memory, 512 * 1024 * 1024)
    assert.equal(registrado.update.NanoCpus, 1_500_000_000)
    assert.equal(registrado.update.PidsLimit, 100)
})

test("os avisos do runtime são REPASSADOS, não engolidos", async () => {
    // O Podman ignora alguns campos em silêncio. Quem pediu precisa saber que
    // o pedido não teve efeito — senão descobre quando a máquina trava.
    const { adaptador } = CriarAdaptador({ update: { Warnings: ["NanoCpus ignorado"] } })

    const resposta = await adaptador.UpdateContainerResources({
        containerIdOrName: "c",
        resources: { cpus: 2 }
    })

    assert.deepEqual(resposta.warnings, ["NanoCpus ignorado"])
})

test("campo ausente NÃO é enviado — ausência e vazio são coisas diferentes", async () => {
    // Mandar CpusetCpus:"" REMOVE a restrição de núcleos; não mandar preserva.
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.UpdateContainerResources({
        containerIdOrName: "c",
        resources: { memoryBytes: "1g", cpusetCpus: "" }
    })

    assert.equal("CpusetCpus" in registrado.update, false)
})

test("atualização sem nenhum recurso é recusada em vez de virar chamada vazia", async () => {
    const { adaptador } = CriarAdaptador()

    await assert.rejects(
        () => adaptador.UpdateContainerResources({ containerIdOrName: "c", resources: {} }),
        (erro) => erro.code === "NO_RESOURCES_TO_UPDATE" && erro.statusCode === 400
    )
})

test("política de reinício é montada na forma que a API espera", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.UpdateContainerResources({
        containerIdOrName: "c",
        resources: { restart: { policy: "on-failure", maximumRetryCount: 3 } }
    })

    assert.deepEqual(registrado.update.RestartPolicy, {
        Name: "on-failure",
        MaximumRetryCount: 3
    })
})

/* ------------------------------ CTMG-39 · processos, mudanças, commit */

test("processos voltam com títulos e linhas", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    const resultado = await adaptador.ListContainerProcesses({
        containerIdOrName: "c", psArgs: "aux"
    })

    assert.deepEqual(registrado.top, { ps_args: "aux" })
    assert.deepEqual(resultado.titles, ["PID", "CMD"])
    assert.deepEqual(resultado.processes, [["1", "sh"]])
})

test("sem psArgs, não manda o parâmetro", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.ListContainerProcesses({ containerIdOrName: "c" })

    assert.deepEqual(registrado.top, {})
})

test("o Kind numérico das mudanças é traduzido", async () => {
    // Nenhum consumidor deveria precisar decorar que 1 é "adicionado".
    const { adaptador } = CriarAdaptador()

    const mudancas = await adaptador.GetContainerFileSystemChanges("c")

    assert.deepEqual(mudancas, [
        { path: "/etc/hosts", kind: "modified", kindCode: 0 },
        { path: "/novo", kind: "added", kindCode: 1 },
        { path: "/foi", kind: "deleted", kindCode: 2 }
    ])
})

test("commit pausa por padrão, para não capturar escrita pela metade", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    const resultado = await adaptador.CommitContainer({
        containerIdOrName: "c", repo: "meu/app", tag: "v1"
    })

    assert.equal(registrado.commit.pause, true)
    assert.equal(registrado.commit.repo, "meu/app")
    assert.equal(registrado.commit.tag, "v1")
    assert.equal(resultado.imageId, "sha256:imagem")
    assert.deepEqual(resultado.imageInfo, { Id: "sha256:imagem" })
})

/* --------------------------------------- CTMG-49 · poda e opções de rede */

test("remoção de volume aceita a forma posicional antiga E a nova", async () => {
    // O service-orchestrator chama com string. Trocar a assinatura sem aceitar
    // a antiga quebraria o provisionamento sem erro visível.
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.RemoveVolume("dados")
    await adaptador.RemoveVolume({ volumeName: "dados", force: true })

    assert.deepEqual(registrado.chamadas, [
        ["volume.remove", {}],
        ["volume.remove", { force: true }]
    ])
})

test("remoção de volume sem nome é recusada antes de tocar no runtime", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await assert.rejects(
        () => adaptador.RemoveVolume({}),
        (erro) => erro.code === "INVALID_VOLUME_NAME"
    )
    assert.deepEqual(registrado.chamadas, [])
})

test("poda de redes e volumes devolve o que foi apagado", async () => {
    const { adaptador } = CriarAdaptador()

    assert.deepEqual(await adaptador.PruneNetworks(), { NetworksDeleted: ["n"], SpaceReclaimed: 0 })
    assert.deepEqual(await adaptador.PruneVolumes(), { VolumesDeleted: ["v"], SpaceReclaimed: 9 })
})

test("gateway FORA da sub-rede é recusado — o daemon aceitaria", () => {
    /*
        Esta é a validação que justifica o helper existir. O daemon cria a rede
        sem reclamar, os containers sobem, e a saída para fora simplesmente não
        funciona — com um sintoma que não aponta para a causa.
    */
    assert.throws(
        () => BuildNetworkOptions({
            name: "minha-rede",
            ipam: { config: [{ subnet: "172.20.0.0/16", gateway: "10.0.0.1" }] }
        }),
        (erro) => erro.code === "INVALID_NETWORK_OPTIONS" && erro.field === "ipam.config[0].gateway"
    )
})

test("gateway DENTRO da sub-rede passa", () => {
    const opcoes = BuildNetworkOptions({
        name: "minha-rede",
        driver: "bridge",
        ipam: { config: [{ subnet: "172.20.0.0/16", gateway: "172.20.0.1", ipRange: "172.20.5.0/24" }] }
    })

    assert.equal(opcoes.Name, "minha-rede")
    assert.deepEqual(opcoes.IPAM.Config[0], {
        Subnet: "172.20.0.0/16",
        IPRange: "172.20.5.0/24",
        Gateway: "172.20.0.1"
    })
})

test("faixa de IP fora da sub-rede é recusada", () => {
    assert.throws(
        () => BuildNetworkOptions({
            name: "r",
            ipam: { config: [{ subnet: "172.20.0.0/24", ipRange: "172.21.0.0/24" }] }
        }),
        (erro) => erro.field === "ipam.config[0].ipRange"
    )
})

test("CIDR malformado é recusado nomeando o campo", () => {
    assert.throws(
        () => BuildNetworkOptions({ name: "r", ipam: { config: [{ subnet: "172.20.0.0" }] } }),
        (erro) => erro.field === "ipam.config[0].subnet"
    )
    assert.throws(
        () => BuildNetworkOptions({ name: "r", ipam: { config: [{ subnet: "999.1.1.0/24" }] } }),
        (erro) => erro.field === "ipam.config[0].subnet"
    )
})

test("rede sem nome é recusada", () => {
    assert.throws(() => BuildNetworkOptions({}), (erro) => erro.field === "name")
})

test("a forma antiga do Docker (Name maiúsculo) passa intacta", async () => {
    // Quem já monta o objeto do Docker continua funcionando sem tradução.
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.CreateNewNetwork({ Name: "legado", Driver: "bridge" })

    assert.deepEqual(registrado.createNetwork, { Name: "legado", Driver: "bridge" })
})

/* --------------------------------------------------- tamanhos e CPUs */

test("tamanhos em potências de 1024, como o docker run", () => {
    assert.equal(ParseByteSize("512m"), 512 * 1024 * 1024)
    assert.equal(ParseByteSize("2g"), 2 * 1024 ** 3)
    assert.equal(ParseByteSize("1.5G"), Math.floor(1.5 * 1024 ** 3))
    assert.equal(ParseByteSize("1024"), 1024)
    assert.equal(ParseByteSize(4096), 4096)
    assert.equal(ParseByteSize(undefined), undefined)
    assert.equal(ParseByteSize(""), undefined)
})

test("tamanho sem sentido é recusado em vez de virar um número qualquer", () => {
    // "512m" tratado como 512 passaria a validação e criaria um container com
    // meio kilobyte de memória, que morre no primeiro instante.
    for (const invalido of ["muito", "12x", "-5", -1]) {
        assert.throws(() => ParseByteSize(invalido), (erro) => erro.code === "INVALID_BYTE_SIZE")
    }
})

test("cpus vira nanossegundos por segundo", () => {
    assert.equal(CpusToNanoCpus(1), 1e9)
    assert.equal(CpusToNanoCpus(0.5), 5e8)
    assert.equal(CpusToNanoCpus("1,5"), 1.5e9)
    assert.equal(CpusToNanoCpus(undefined), undefined)
    assert.throws(() => CpusToNanoCpus(0), (erro) => erro.code === "INVALID_BYTE_SIZE")
})
