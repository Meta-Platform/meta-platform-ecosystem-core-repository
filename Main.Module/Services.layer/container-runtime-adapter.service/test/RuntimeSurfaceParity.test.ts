/*
    Paridade entre as duas superfícies (CTMG-33).

    Este teste existe para falhar. Enquanto ele passa, o `ContainerRuntimeAdapter`
    e o `ContainerRuntimeClient` oferecem a mesma coisa — que é o que o README
    afirmava sem que nada garantisse. Quando alguém adicionar uma operação a um
    lado só, aqui é onde vai aparecer, com o nome da operação na mensagem.
*/
const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert/strict") as typeof import("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")
const ContainerRuntimeClientService = require("../src/Services/ContainerRuntimeClient.service")
const { RUNTIME_SURFACE, CLIENT_SUPPORTED, SURFACE_BY_NAME } = require("../src/RuntimeSurface")

const CriarAdaptador = () => ContainerManager({
    socketPath: "/tmp/irrelevante.sock",
    CreateClient: () => ({ getEvents: () => {} })
})

const CriarCliente = () => ContainerRuntimeClientService({
    containerRuntimeSocketPath: "/tmp/irrelevante.sock",
    containerRuntimeServerManagerUrl: "/server-manager/status",
    commandExecutorLib: { require: () => async () => ({}) }
})

test("toda operação do adaptador está declarada no manifesto", () => {
    const adaptador = CriarAdaptador()
    const declaradas = new Set(RUNTIME_SURFACE.map((entrada: any) => entrada.name))

    const naoDeclaradas = Object.keys(adaptador).filter((nome: string) => !declaradas.has(nome))

    assert.deepEqual(
        naoDeclaradas,
        [],
        `Operação no adaptador e ausente do manifesto: ${naoDeclaradas.join(", ")}. ` +
        "Declare em src/RuntimeSurface.js, dizendo se o cliente deve implementá-la."
    )
})

test("toda operação do manifesto existe no adaptador", () => {
    const adaptador = CriarAdaptador()

    const faltando = RUNTIME_SURFACE
        .map((entrada: any) => entrada.name)
        .filter((nome: string) => typeof adaptador[nome] !== "function")

    assert.deepEqual(
        faltando,
        [],
        `Declarada no manifesto e ausente do adaptador: ${faltando.join(", ")}.`
    )
})

test("toda operação marcada como suportada existe no cliente", () => {
    const cliente = CriarCliente()

    const faltando = CLIENT_SUPPORTED.filter((nome: string) => typeof cliente[nome] !== "function")

    assert.deepEqual(
        faltando,
        [],
        `Marcada como clientSupported e ausente do ContainerRuntimeClient: ${faltando.join(", ")}.`
    )
})

test("operação não suportada declara o motivo", () => {
    const semMotivo = RUNTIME_SURFACE
        .filter((entrada: any) => !entrada.clientSupported && !entrada.reason)
        .map((entrada: any) => entrada.name)

    assert.deepEqual(
        semMotivo,
        [],
        `Sem clientSupported e sem reason: ${semMotivo.join(", ")}. ` +
        "Quem for chamar precisa saber por que não pode."
    )
})

test("o cliente não inventa operação fora do manifesto", () => {
    const cliente = CriarCliente()
    const declaradas = new Set(RUNTIME_SURFACE.map((entrada: any) => entrada.name))

    const extras = Object.keys(cliente).filter((nome: string) => !declaradas.has(nome))

    assert.deepEqual(extras, [], `No cliente e fora do manifesto: ${extras.join(", ")}.`)
})

test("stream chamado pelo cliente explica por que não dá, em vez de sumir", () => {
    const cliente = CriarCliente()

    // A mensagem tem de carregar o motivo QUE O MANIFESTO declara — cada
    // operação tem o seu, e repetir um texto genérico esconderia a diferença.
    for (const nome of ["StreamContainerLogs", "StreamContainerStats", "OpenExecSession"]) {
        const motivo = SURFACE_BY_NAME[nome].reason

        assert.equal(typeof cliente[nome], "function", `${nome} deveria existir no cliente`)
        assert.throws(
            () => cliente[nome]({}),
            (erro: any) =>
                erro.code === "STREAM_UNSUPPORTED_OVER_SOCKET"
                && erro.operation === nome
                && erro.message.includes(motivo),
            `${nome} deveria lançar com o motivo declarado no manifesto`
        )
    }
})

test("os cinco métodos que faltavam existem e são chamáveis", () => {
    const cliente = CriarCliente()

    for (const nome of [
        "BuildImageFromDockerfileContent",
        "ListVolumeEntries",
        "PutFileInVolume",
        "GetFileFromVolume",
        "DeleteVolumeEntry"
    ]) {
        assert.equal(typeof cliente[nome], "function", `${nome} ausente do cliente`)
    }
})
