/*
    PUBLICAÇÃO É TRÊS REGISTROS — este script é quem confere.

    Um método do adaptador só existe para quem chama se estiver nos TRÊS
    lugares:

      1. a operação, em `container-runtime-adapter.service/src/Operations/*`;
      2. a linha no controller deste pacote (que lista método a método);
      3. a entrada no manifesto `src/APIs/ContainerRuntime.api.json`.

    Faltando (3) não há endpoint. Faltando (2) o endpoint existe e responde
    "o summary X do controller ContainerRuntimeController está indefinido" —
    uma mensagem que só aparece em runtime, e só quando alguém tenta usar.

    POR QUE ISTO EXISTE: em agosto de 2026, três métodos (MakeVolumeDirectory,
    MoveVolumeEntry, PutFileChunkInVolume) ficaram escritos e inalcançáveis por
    dias. A verificação usada na época era procurar o código no arquivo — e
    código presente não é código publicado. Este script transforma essa
    verificação numa que não depende de ninguém lembrar.

    Não sobe container, não fala com Docker: as três listas são lidas do
    próprio repositório, e o adaptador é instanciado com um socket falso só
    para expor os nomes que ele oferece.

    Uso: node scripts/test-api-publication.js
*/
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const RAIZ_DO_APP = path.join(__dirname, "..")
const RAIZ_DO_SERVICO = path.join(RAIZ_DO_APP, "..", "..", "Services.layer", "container-runtime-adapter.service")

const CarregarManifesto = () => {
    const conteudo = fs.readFileSync(
        path.join(RAIZ_DO_APP, "src", "APIs", "ContainerRuntime.api.json"), "utf-8")
    return JSON.parse(conteudo)
}

/*
    O controller é LIDO, não executado: executá-lo exigiria montar o serviço
    inteiro, e o que interessa aqui é exatamente o texto — quais nomes ele
    encaminha para o serviço.
*/
const NomesDoController = () => {
    const conteudo = fs.readFileSync(
        path.join(RAIZ_DO_APP, "src", "Controllers", "ContainerRuntime.controller.js"), "utf-8")

    const nomes = []
    const padrao = /([A-Za-z0-9_]+)\s*:\s*containerRuntimeAdapterService\.([A-Za-z0-9_]+)/g
    let encontrado = padrao.exec(conteudo)
    while (encontrado !== null) {
        nomes.push({ exposto: encontrado[1], noServico: encontrado[2] })
        encontrado = padrao.exec(conteudo)
    }
    return nomes
}

const NomesDoAdaptador = () => {
    const ContainerManager = require(path.join(RAIZ_DO_SERVICO, "src", "Managers", "Container.manager"))
    const adaptador = ContainerManager({
        socketPath   : "/tmp/irrelevante.sock",
        CreateClient : () => ({ getEvents: () => {} })
    })
    return Object.keys(adaptador)
}

const Executar = () => {
    const manifesto = CarregarManifesto()
    const doManifesto = manifesto.endpoints.map((endpoint) => endpoint.summary)
    const doController = NomesDoController()
    const doAdaptador = NomesDoAdaptador()

    const falhas = []

    const Conferir = (titulo, funcao) => {
        try {
            funcao()
            console.log(`  OK    ${titulo}`)
        } catch (error) {
            falhas.push(titulo)
            console.log(`  FALHA ${titulo}`)
            console.log(`        ${error.message.split("\n")[0]}`)
        }
    }

    console.log("Publicação do container-runtime-adapter (os três registros)\n")

    Conferir("todo endpoint do manifesto tem linha no controller", () => {
        const expostos = doController.map((entrada) => entrada.exposto)
        const semLinha = doManifesto.filter((nome) => expostos.indexOf(nome) === -1)
        assert.deepEqual(semLinha, [],
            `No manifesto e ausente do controller: ${semLinha.join(", ")}. ` +
            "O endpoint existe e responde que o summary está indefinido.")
    })

    Conferir("toda linha do controller tem endpoint no manifesto", () => {
        const semEndpoint = doController
            .map((entrada) => entrada.exposto)
            .filter((nome) => doManifesto.indexOf(nome) === -1)
        assert.deepEqual(semEndpoint, [],
            `No controller e ausente do manifesto: ${semEndpoint.join(", ")}. ` +
            "Sem entrada no manifesto não existe endpoint nenhum.")
    })

    Conferir("toda linha do controller aponta para uma operação que existe", () => {
        const inexistentes = doController
            .filter((entrada) => doAdaptador.indexOf(entrada.noServico) === -1)
            .map((entrada) => entrada.noServico)
        assert.deepEqual(inexistentes, [],
            `Encaminhado pelo controller e inexistente no adaptador: ${inexistentes.join(", ")}.`)
    })

    Conferir("nenhum endpoint duplicado no manifesto", () => {
        const vistos = {}
        const duplicados = []
        doManifesto.forEach((nome) => {
            if (vistos[nome]) duplicados.push(nome)
            vistos[nome] = true
        })
        assert.deepEqual(duplicados, [], `Endpoint declarado duas vezes: ${duplicados.join(", ")}.`)
    })

    Conferir("nenhum caminho de endpoint duplicado no manifesto", () => {
        const vistos = {}
        const duplicados = []
        manifesto.endpoints.forEach((endpoint) => {
            const chave = `${endpoint.method} ${endpoint.path}`
            if (vistos[chave]) duplicados.push(chave)
            vistos[chave] = true
        })
        assert.deepEqual(duplicados, [], `Caminho declarado duas vezes: ${duplicados.join(", ")}.`)
    })

    /*
        Os métodos de arquivo em volume são os que a plataforma inteira usa para
        mover dado do usuário. Estão nomeados um a um de propósito: uma lista
        explícita falha quando alguém REMOVE um deles, coisa que nenhuma
        checagem de coerência entre listas pega — as três listas continuariam
        coerentes entre si, e o painel do usuário pararia.
    */
    Conferir("os métodos de arquivo em volume continuam publicados", () => {
        const obrigatorios = [
            "ListVolumeEntries", "PutFileInVolume", "GetFileFromVolume", "DeleteVolumeEntry",
            "MakeVolumeDirectory", "MoveVolumeEntry",
            "PutFileChunkInVolume", "GetFileChunkFromVolume",
            "InspectVolumeUpload", "GetVolumeUsage"
        ]
        const faltando = obrigatorios.filter((nome) => doManifesto.indexOf(nome) === -1)
        assert.deepEqual(faltando, [], `Deixou de ser publicado: ${faltando.join(", ")}.`)
    })

    console.log("")
    if (falhas.length > 0) {
        console.log(`FALHOU: ${falhas.length} verificação(ões).`)
        process.exit(1)
    }
    console.log("TUDO OK")
}

Executar()
