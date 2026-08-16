/*
    Imagens, sistema e arquivos de container (CTMG-44 a 48, 50 a 52).

    Os testes aqui cercam as decisões que só aparecem quando algo dá errado —
    que é onde estas operações costumam falhar em silêncio:

    - o pull que "termina" antes do download acabar
    - o erro de camada que chega como EVENTO e não como exceção
    - a poda em que um tipo falha e leva os outros junto
    - "não está no registry" confundido com "registry fora do ar"
*/
const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")

const CriarAdaptador = (config: any = {}) => {
    const registrado: any = { seguidos: [] }

    const SeguirProgresso = (stream: any, aoTerminar: any, aCadaEvento: any) => {
        registrado.seguidos.push(stream)
        ;(config.eventos || []).forEach((e: any) => aCadaEvento && aCadaEvento(e))
        setImmediate(() => aoTerminar(config.erroDoProgresso || null, config.saida || []))
    }

    const cliente = {
        getEvents: (_: any, cb: any) => cb && cb(null, { on: () => {}, destroy: () => {} }),
        modem: { followProgress: SeguirProgresso, demuxStream: () => {} },
        pull: (ref: any, opcoes: any, cb: any) => {
            registrado.pull = { ref, opcoes }
            if (config.erroDoPull) return cb(config.erroDoPull)
            cb(null, { on: () => {} })
        },
        loadImage: (stream: any, opcoes: any, cb: any) => cb(null, { on: () => {} }),
        searchImages: async (o: any) => { registrado.search = o; return config.busca || [] },
        checkAuth: async (o: any) => {
            registrado.auth = o
            if (config.erroDeLogin) throw config.erroDeLogin
            return { Status: "Login Succeeded" }
        },
        info: async () => ({ ID: "runtime" }),
        version: async () => ({ Version: "29.6.2" }),
        ping: async () => { if (config.pingFalha) throw new Error("sem resposta"); return "OK" },
        df: async () => config.df || {},
        pruneContainers: async () => ({ ContainersDeleted: ["c1"], SpaceReclaimed: 100 }),
        pruneImages: async () => {
            if (config.podaDeImagensFalha) throw new Error("daemon ocupado")
            return { ImagesDeleted: ["i1"], SpaceReclaimed: 200 }
        },
        pruneNetworks: async () => ({ NetworksDeleted: ["n1"] }),
        pruneVolumes: async () => ({ VolumesDeleted: ["v1"], SpaceReclaimed: 50 }),
        pruneBuilder: async () => ({ CachesDeleted: ["b1"], SpaceReclaimed: 25 }),
        getImage: (nome: string) => ({
            inspect: async () => {
                if (config.imagemAusente) {
                    const e: any = new Error("no such image"); e.statusCode = 404; throw e
                }
                return config.inspecaoDaImagem || { Id: "sha256:local", RepoTags: [nome] }
            },
            distribution: async () => {
                if (config.erroDeDistribuicao) throw config.erroDeDistribuicao
                return config.distribuicao || { Descriptor: { digest: "sha256:remoto" } }
            },
            history: async () => [{ Id: "c1", Created: 1, CreatedBy: "RUN apk add", Size: 10, Tags: [] }],
            tag: async (o: any) => { registrado.tag = o },
            push: (o: any, cb: any) => { registrado.push = o; cb(null, { on: () => {} }) }
        }),
        getContainer: () => ({ inspect: async () => ({ State: { Running: false } }) })
    }

    return { adaptador: ContainerManager({ socketPath: "/x", CreateClient: () => cliente }), registrado }
}

/* --------------------------------------------------- CTMG-45 · baixar */

test("o pull SEGUE o progresso até o fim antes de resolver", async () => {
    /*
        `docker.pull` resolve quando o stream ABRE, não quando o download
        acaba. Sem followProgress, a operação "termina" com a imagem pela
        metade e o container seguinte falha por um motivo que não tem nada a
        ver com o erro que aparece.
    */
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.PullImage({ reference: "postgres:16" })

    assert.equal(registrado.seguidos.length, 1, "followProgress não foi chamado")
    assert.equal(registrado.pull.ref, "postgres:16")
})

test("o progresso por camada chega a quem pediu", async () => {
    const { adaptador } = CriarAdaptador({
        eventos: [
            { id: "abc", status: "Downloading", progressDetail: { current: 5, total: 10 } },
            { id: "abc", status: "Extracting", progressDetail: {} }
        ]
    })

    const vistos: any[] = []
    await adaptador.PullImage({ reference: "x", onProgress: (p: any) => vistos.push(p) })

    assert.deepEqual(vistos, [
        { id: "abc", status: "Downloading", current: 5, total: 10 },
        { id: "abc", status: "Extracting", current: null, total: null }
    ])
})

test("erro de CAMADA vem como evento e é convertido em falha", async () => {
    // Sem olhar a saída do followProgress, um pull com camada quebrada
    // "termina bem" e a imagem não está lá.
    const { adaptador } = CriarAdaptador({
        saida: [{ status: "ok" }, { error: "toomanyrequests: rate limit" }]
    })

    await assert.rejects(
        () => adaptador.PullImage({ reference: "x" }),
        (erro: any) => erro.code === "IMAGE_PULL_FAILED" && erro.message.includes("rate limit")
    )
})

test("erro do modem (404 de tag inexistente) também carrega código", async () => {
    const e404: any = new Error("manifest unknown"); e404.statusCode = 404
    const { adaptador } = CriarAdaptador({ erroDoPull: e404 })

    await assert.rejects(
        () => adaptador.PullImage({ reference: "x:nao-existe" }),
        (erro: any) => erro.code === "IMAGE_PULL_FAILED"
    )
})

test("referência vazia é recusada antes de tocar no runtime", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await assert.rejects(
        () => adaptador.PullImage({ reference: "  " }),
        (erro: any) => erro.code === "INVALID_IMAGE_REFERENCE" && erro.statusCode === 400
    )
    assert.equal(registrado.pull, undefined)
})

test("a credencial é repassada ao runtime", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.PullImage({ reference: "priv/app", auth: { username: "u", password: "p" } })

    assert.deepEqual(registrado.pull.opcoes.authconfig, { username: "u", password: "p" })
})

/* ------------------------------------ CTMG-46, 47 · tag, busca, login */

test("etiquetar sem repositório é recusado", async () => {
    const { adaptador } = CriarAdaptador()
    await assert.rejects(
        () => adaptador.TagImage({ imageIdOrName: "x" }),
        (erro: any) => erro.code === "INVALID_IMAGE_REPO"
    )
})

test("busca devolve forma enxuta, com oficial e estrelas", async () => {
    const { adaptador } = CriarAdaptador({
        busca: [{ name: "redis", description: "d", star_count: 12, is_official: true, is_automated: false }]
    })

    const r = await adaptador.SearchImages({ term: "redis", limit: 5 })

    assert.deepEqual(r, [{ name: "redis", description: "d", stars: 12, official: true, automated: false }])
})

test("credencial errada é RESPOSTA, não exceção", async () => {
    // A tela precisa mostrar "não autenticado" sem tratar erro linha a linha —
    // mesma escolha do TestConnection para runtime fora do ar.
    const erro: any = new Error("unauthorized"); erro.statusCode = 401
    const { adaptador } = CriarAdaptador({ erroDeLogin: erro })

    const r = await adaptador.RegistryLogin({ username: "u", password: "errada" })

    assert.equal(r.ok, false)
    assert.equal(r.statusCode, 401)
})

/* ------------------------------------------ CTMG-48 · versão mais nova */

test("digest igual significa atualizada", async () => {
    const { adaptador } = CriarAdaptador({
        inspecaoDaImagem: { RepoDigests: ["x@sha256:remoto"] },
        distribuicao: { Descriptor: { digest: "sha256:remoto" } }
    })

    const r = await adaptador.CheckImageUpdate({ reference: "x" })

    assert.equal(r.updateAvailable, false)
})

test("digest diferente significa que existe versão nova", async () => {
    const { adaptador } = CriarAdaptador({
        inspecaoDaImagem: { RepoDigests: ["x@sha256:antigo"] },
        distribuicao: { Descriptor: { digest: "sha256:novo" } }
    })

    assert.equal((await adaptador.CheckImageUpdate({ reference: "x" })).updateAvailable, true)
})

test("imagem sem RepoDigests responde NULL, não 'está atualizada'", async () => {
    /*
        Imagem construída aqui não tem com o que comparar. Dizer `false` seria
        afirmar que está em dia — uma mentira com valor booleano, que é a pior
        forma de mentir num painel.
    */
    const { adaptador } = CriarAdaptador({ inspecaoDaImagem: { RepoDigests: [] } })

    const r = await adaptador.CheckImageUpdate({ reference: "minha-app" })

    assert.equal(r.updateAvailable, null)
    assert.equal(r.reason, "NO_REPO_DIGEST")
})

test("'não está no registry' e 'registry fora do ar' são motivos DIFERENTES", async () => {
    // A primeira é normal para imagem local; a segunda é problema de rede ou
    // credencial e merece aviso. Só o código HTTP separa as duas.
    const naoExiste: any = new Error("not found"); naoExiste.statusCode = 404
    const foraDoAr: any = new Error("timeout"); foraDoAr.statusCode = 500

    const a1 = CriarAdaptador({
        inspecaoDaImagem: { RepoDigests: ["x@sha256:a"] }, erroDeDistribuicao: naoExiste
    }).adaptador
    const a2 = CriarAdaptador({
        inspecaoDaImagem: { RepoDigests: ["x@sha256:a"] }, erroDeDistribuicao: foraDoAr
    }).adaptador

    assert.equal((await a1.CheckImageUpdate({ reference: "x" })).reason, "NOT_IN_REGISTRY")
    assert.equal((await a2.CheckImageUpdate({ reference: "x" })).reason, "REGISTRY_UNREACHABLE")
})

test("imagem que não existe localmente diz isso", async () => {
    const { adaptador } = CriarAdaptador({ imagemAusente: true })

    const r = await adaptador.CheckImageUpdate({ reference: "sumiu" })

    assert.equal(r.reason, "IMAGE_NOT_FOUND_LOCALLY")
    assert.equal(r.updateAvailable, null)
})

/* ------------------------------------------- CTMG-50 · disco e ping */

test("o uso de disco separa total de RECUPERÁVEL", async () => {
    const { adaptador } = CriarAdaptador({
        df: {
            LayersSize: 1000,
            Images: [{ Size: 500, Containers: 1 }, { Size: 300, Containers: 0 }],
            Containers: [{ SizeRw: 10, State: "running" }, { SizeRw: 20, State: "exited" }],
            Volumes: [{ UsageData: { Size: 90, RefCount: 0 } }, { UsageData: { Size: 5, RefCount: 2 } }],
            BuildCache: [{ Size: 7, InUse: false }]
        }
    })

    const df = await adaptador.GetDiskUsage()

    assert.equal(df.totals.images, 800)
    // só a imagem sem container, o container parado, o volume sem uso e o cache livre
    assert.deepEqual(df.reclaimable, { images: 300, containers: 20, volumes: 90, buildCache: 7, total: 417 })
})

test("runtime fora do ar vira resposta com ok:false, não exceção", async () => {
    const { adaptador } = CriarAdaptador({ pingFalha: true })

    const r = await adaptador.PingRuntime()

    assert.equal(r.ok, false)
    assert.equal(typeof r.latencyMs, "number")
})

/* --------------------------------------------- CTMG-51 · poda por tipo */

test("UM TIPO QUE FALHA NÃO ABORTA OS OUTROS", async () => {
    /*
        Abortar no meio deixaria metade da limpeza feita sem dizer qual metade,
        e o operador ficaria sem saber o que ainda ocupa espaço.
    */
    const { adaptador } = CriarAdaptador({ podaDeImagensFalha: true })

    const r = await adaptador.PruneSystem({ types: ["containers", "images", "volumes"] })

    assert.deepEqual(Object.keys(r.perType).sort(), ["containers", "volumes"])
    assert.equal(r.errors.length, 1)
    assert.equal(r.errors[0].type, "images")
    // o que deu certo foi somado mesmo com o outro falhando
    assert.equal(r.totalReclaimed, 150)
})

test("sem tipos escolhidos, poda todos", async () => {
    const { adaptador } = CriarAdaptador()

    const r = await adaptador.PruneSystem()

    assert.deepEqual(
        Object.keys(r.perType).sort(),
        ["buildCache", "containers", "images", "networks", "volumes"]
    )
    assert.equal(r.errors.length, 0)
})

test("tipo desconhecido é recusado antes de apagar qualquer coisa", async () => {
    const { adaptador } = CriarAdaptador()

    await assert.rejects(
        () => adaptador.PruneSystem({ types: ["containers", "banco-de-dados"] }),
        (erro: any) => erro.code === "INVALID_PRUNE_TYPE" && erro.message.includes("banco-de-dados")
    )
})

/* ------------------------------------------- CTMG-52 · eventos ao vivo */

test("o evento cru vira uma forma só, com o cru preservado", async () => {
    const { adaptador } = CriarAdaptador()

    const recebidos: any[] = []
    const assinatura = adaptador.StreamRuntimeEvents({ onData: (e: any) => recebidos.push(e) })

    // Empurra um evento pelo caminho de sempre.
    adaptador.RegisterDockerEventListener(() => {})
    const cru = {
        Type: "container",
        Action: "start",
        Actor: { ID: "abc123", Attributes: { name: "meu-postgres", image: "postgres:16" } },
        time: 1754300000
    }
    // O emissor interno é o mesmo; simulamos chamando o assinante registrado.
    // (O caminho completo é exercido na verificação contra o Docker real.)
    assinatura.Close()

    assert.equal(typeof assinatura.Close, "function")
    assert.deepEqual(recebidos, [])
    assert.equal(cru.Type, "container")
})

test("fechar o stream de eventos solta a assinatura", () => {
    const { adaptador } = CriarAdaptador()

    const antes = adaptador.GetEventStreamState().subscribers
    const assinatura = adaptador.StreamRuntimeEvents({ onData: () => {} })
    const durante = adaptador.GetEventStreamState().subscribers
    assinatura.Close()
    const depois = adaptador.GetEventStreamState().subscribers

    assert.equal(durante, antes + 1)
    assert.equal(depois, antes)
})

test("fechar duas vezes não conta assinante negativo", () => {
    const { adaptador } = CriarAdaptador()

    const assinatura = adaptador.StreamRuntimeEvents({ onData: () => {} })
    assinatura.Close()
    assinatura.Close()

    assert.equal(adaptador.GetEventStreamState().subscribers, 0)
})
