/*
    A superfície do adaptador, congelada (CTMG-36).

    O manager foi fatiado em seis módulos de operações. Uma refatoração assim
    erra de um jeito específico e silencioso: uma operação some porque o módulo
    esqueceu de exportá-la, ou uma assinatura muda porque a desestruturação foi
    reescrita "igual" mas não era. Nada disso quebra na hora — quebra quando
    alguém chama, em produção, e recebe `undefined is not a function`.

    A lista abaixo foi extraída do arquivo ANTES do fatiamento e comparada com o
    resultado: 36 operações, mesmos nomes, mesma aridade. Ela fica aqui como
    contrato.

    RuntimeSurfaceParity cobre outra coisa — manifesto contra implementações.
    Este cobre a implementação contra o passado dela. Os dois juntos significam:
    operação nova é declarada no manifesto E aparece aqui, de propósito, por
    quem a escreveu.

    Ao ADICIONAR uma operação (é o esperado no épico CTMG-35): acrescente a
    linha aqui e a entrada em src/RuntimeSurface.js. Ao REMOVER ou renomear uma:
    pare e confira quem chama — inclusive o ServiceOrchestrator, que vive em
    outro repositório.
*/
const test = require("node:test")
const assert = require("node:assert/strict")

const ContainerManager = require("../src/Managers/Container.manager")

// nome/aridade, em ordem alfabética
const SUPERFICIE_ESPERADA = [
    "BuildImageFromDockerfileContent/1",
    "BuildImageFromDockerfileString/1",
    "ConnectContainerToNetwork/1",
    "CreateNewContainer/1",
    "CreateNewNetwork/1",
    "CreateNewVolume/1",
    "DeleteVolumeEntry/1",
    "DisconnectContainerFromNetwork/1",
    "ExportContainer/1",
    "ExportImage/1",
    "ExportVolume/1",
    "GetContainerLogHistory/1",
    "GetContainerStatsSnapshot/1",
    "GetEventStreamState/0",
    "GetFileFromVolume/1",
    "InspectContainer/1",
    "InspectImage/1",
    "InspectNetwork/1",
    "InspectVolume/1",
    "KillContainer/1",
    "ListAllContainers/0",
    "ListAllImages/0",
    "ListAllNetworks/0",
    "ListAllVolumes/0",
    "ListVolumeEntries/1",
    "OpenExecSession/1",
    "PauseContainer/1",
    "PruneContainers/0",
    "PutFileInVolume/1",
    "RegisterDockerEventListener/1",
    "RemoveContainer/1",
    "RemoveImage/1",
    "RemoveNetwork/1",
    "RemoveVolume/1",
    "RenameContainer/1",
    "RestartContainer/1",
    "RunExec/1",
    "StartContainer/1",
    "StopContainer/1",
    "StreamContainerLogs/1",
    "StreamContainerStats/1",
    "UnpauseContainer/1",
    "WaitContainer/1"
]

const CriarAdaptador = () => ContainerManager({
    socketPath: "/tmp/irrelevante.sock",
    CreateClient: () => ({ getEvents: () => {} })
})

test("a superfície pública é exatamente a de antes do fatiamento", () => {
    const adaptador = CriarAdaptador()

    const atual = Object.keys(adaptador)
        .sort()
        .map((nome) => `${nome}/${adaptador[nome].length}`)

    assert.deepEqual(atual, SUPERFICIE_ESPERADA)
})

test("toda operação exposta é função", () => {
    const adaptador = CriarAdaptador()

    const naoFuncoes = Object.keys(adaptador)
        .filter((nome) => typeof adaptador[nome] !== "function")

    assert.deepEqual(naoFuncoes, [], `Exposto e não é função: ${naoFuncoes.join(", ")}`)
})

test("cada módulo de operações contribui, e nenhum sobrescreve o outro", () => {
    /*
        A composição é feita com spread: se dois módulos exportassem o mesmo
        nome, o último calaria o primeiro sem aviso nenhum. Somar os tamanhos e
        comparar com o total é o jeito barato de provar que não há colisão.
    */
    const contextoFalso = {
        docker: { getEvents: () => {} },
        StreamToBuffer: async () => Buffer.alloc(0),
        SafeFileName: (v) => String(v),
        ephemeral: {
            VOLUME_EXPORT_IMAGE: "alpine:latest",
            EnsureVolumeExportImage: async () => {},
            CreateEphemeralVolumeContainer: async () => ({}),
            RunEphemeralAndCollect: async () => ({ statusCode: 0, stdout: "", stderr: "" }),
            RemoveEphemeral: async () => {}
        }
    }

    const modulos = [
        "../src/Operations/Containers.ops",
        "../src/Operations/Images.ops",
        "../src/Operations/Networks.ops",
        "../src/Operations/Volumes.ops",
        "../src/Operations/Files.ops",
        "../src/Operations/System.ops"
    ].map((caminho) => require(caminho)(contextoFalso))

    const somaDasPartes = modulos.reduce((total, modulo) => total + Object.keys(modulo).length, 0)

    assert.equal(
        somaDasPartes,
        SUPERFICIE_ESPERADA.length,
        "Dois módulos exportam o mesmo nome — um está calando o outro no spread."
    )
})
