/*
    O caso que derrubava o aplicativo de mesa: listar `/` de um container
    PARADO (CTMG-93, CTMG-101).

    Sem processo de pé não há `stat` para rodar, então a listagem vem do
    `getArchive` — que traz o conteúdo recursivo INTEIRO. Juntar esse tar num
    Buffer para depois olhar só os cabeçalhos custava o filesystem do container
    em memória, e o `Buffer.concat` estourava com `RangeError: Array buffer
    allocation failed`. Como esse erro nasce no ouvinte de `end`, fora da cadeia
    da Promise, ele NÃO virava rejeição: derrubava o processo inteiro.

    Os testes abaixo fixam as duas metades da correção — listar não bufferiza, e
    o que bufferiza tem teto e rejeita em vez de morrer — sem Docker e sem
    container.
*/
const test = require("node:test")
const assert = require("node:assert/strict")
const { Readable } = require("node:stream")

const StreamToBuffer = require("../src/Helpers/StreamToBuffer")
const CreateFileOperations = require("../src/Operations/Files.ops")
const {
    BuildTarWithSingleFile,
    ReadTarEntries,
    ReadTarEntriesFromStream,
    BLOCK_SIZE
} = require("../src/Helpers/TarSingleFile")

/*
    Um tar com várias entradas a partir do construtor de arquivo único: cada
    pedaço perde os dois blocos zerados do fim, que só voltam uma vez, no fecho.
*/
const MontarTar = (arquivos) => {
    const corpos = arquivos.map(({ name, content = "" }) => {
        const inteiro = BuildTarWithSingleFile({ name, content })
        return inteiro.subarray(0, inteiro.length - BLOCK_SIZE * 2)
    })
    return Buffer.concat([...corpos, Buffer.alloc(BLOCK_SIZE * 2)])
}

// Fatias pequenas de propósito: um cabeçalho parte ao meio entre dois chunks, e
// o leitor precisa aguentar isso.
const ComoFluxo = (buffer, tamanhoDoPedaco = 100) => Readable.from(
    (function* () {
        for (let inicio = 0; inicio < buffer.length; inicio += tamanhoDoPedaco) {
            yield buffer.subarray(inicio, inicio + tamanhoDoPedaco)
        }
    })()
)

test("o leitor em fluxo devolve os cabeçalhos mesmo com o tar picado", async () => {
    const tar = MontarTar([
        { name: "etc/", content: "" },
        { name: "etc/hosts", content: "127.0.0.1 localhost\n" },
        { name: "etc/passwd", content: "root:x:0:0\n" }
    ])

    const { entries, truncated } = await ReadTarEntriesFromStream(ComoFluxo(tar, 37))

    assert.equal(truncated, false)
    assert.deepEqual(entries.map((e) => e.name), ["etc/", "etc/hosts", "etc/passwd"])
    assert.equal(entries[1].size, 20)
    // Listar não carrega conteúdo — é justamente o que tornava a listagem cara.
    assert.equal(entries[1].content, undefined)
})

test("tar cortado antes do fim é admitido, não completado", async () => {
    const tar = MontarTar([{ name: "etc/hosts", content: "127.0.0.1\n" }])
    const cortado = tar.subarray(0, tar.length - BLOCK_SIZE * 2)

    const { entries, truncated } = await ReadTarEntriesFromStream(ComoFluxo(cortado))

    assert.equal(entries.length, 1)
    assert.equal(truncated, true)
})

test("listar container parado não passa o tar pela memória", async () => {
    const tar = MontarTar([
        { name: "etc/", content: "" },
        { name: "etc/hosts", content: "x".repeat(4096) },
        { name: "etc/ssl/", content: "" },
        { name: "etc/ssl/cert.pem", content: "y".repeat(2048) }
    ])

    const docker = {
        getContainer: () => ({
            inspect: async () => ({ State: { Running: false } }),
            getArchive: async () => ComoFluxo(tar)
        })
    }

    const operacoes = CreateFileOperations({
        docker,
        // Se a listagem voltar a bufferizar, o teste acusa aqui — e não numa
        // máquina do usuário, com 3 GB de RSS e um diálogo sem contexto.
        StreamToBuffer: async () => {
            throw new Error("listagem não deve juntar o tar em memória")
        },
        ephemeral: {},
        RunExec: async () => { throw new Error("container parado não roda exec") }
    })

    const resultado = await operacoes.ListContainerEntries({
        containerIdOrName: "parado",
        path: "/etc"
    })

    assert.equal(resultado.source, "archive")
    assert.deepEqual(resultado.entries.map((e) => e.name), ["ssl", "hosts"])
    assert.equal(resultado.entries[0].isDirectory, true)
    assert.equal(resultado.entries[1].size, 4096)
})

/*
    Caminho que não cabe nos 100 bytes do campo `name`. São as duas formas que
    aparecem num tar de filesystem: o `prefix` do USTAR e o cabeçalho estendido
    do PAX, que é o que o Go — e portanto o Docker — emite.
*/
const ComPrefixoUstar = (prefix, name) => {
    const bloco = BuildTarWithSingleFile({ name, content: "x" })
    bloco.write(prefix, 345, 155, "utf-8")
    // O checksum cobre o cabeçalho inteiro; mexer no prefixo o invalida.
    bloco.write(" ".repeat(8), 148, 8, "utf-8")
    let soma = 0
    for (const byte of bloco.subarray(0, BLOCK_SIZE)) soma += byte
    bloco.write(soma.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf-8")
    return bloco.subarray(0, bloco.length - BLOCK_SIZE * 2)
}

const ComCabecalhoPax = (caminho, nomeCurto) => {
    const registro = (() => {
        const corpo = `path=${caminho}\n`
        for (let tamanho = corpo.length + 2; ; tamanho += 1) {
            const linha = `${tamanho} ${corpo}`
            if (linha.length === tamanho) return linha
        }
    })()

    const cabecalho = BuildTarWithSingleFile({ name: "PaxHeaders/0", content: registro })
    cabecalho.write("x", 156, 1, "utf-8")
    cabecalho.write(" ".repeat(8), 148, 8, "utf-8")
    let soma = 0
    for (const byte of cabecalho.subarray(0, BLOCK_SIZE)) soma += byte
    cabecalho.write(soma.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf-8")

    const arquivo = BuildTarWithSingleFile({ name: nomeCurto, content: "y" })

    return Buffer.concat([
        cabecalho.subarray(0, cabecalho.length - BLOCK_SIZE * 2),
        arquivo.subarray(0, arquivo.length - BLOCK_SIZE * 2)
    ])
}

test("caminho longo não vira entrada de primeiro nível", async () => {
    const tar = Buffer.concat([
        ComPrefixoUstar("usr/lib/python3.11", "__pycache__/"),
        ComCabecalhoPax("usr/share/doc/pacote/muito/fundo/LEIAME", "LEIAME"),
        Buffer.alloc(BLOCK_SIZE * 2)
    ])

    const { entries } = await ReadTarEntriesFromStream(ComoFluxo(tar, 64))

    assert.deepEqual(entries.map((e) => e.name), [
        "usr/lib/python3.11/__pycache__/",
        "usr/share/doc/pacote/muito/fundo/LEIAME"
    ])
    // O bloco de metadado descreve o vizinho; ele mesmo não é arquivo.
    assert.equal(entries.length, 2)
})

test("a leitura por buffer conhece os mesmos caminhos longos", () => {
    const tar = Buffer.concat([
        ComPrefixoUstar("usr/lib/python3.11", "__pycache__/"),
        ComCabecalhoPax("usr/share/doc/pacote/muito/fundo/LEIAME", "LEIAME"),
        Buffer.alloc(BLOCK_SIZE * 2)
    ])

    const { entries } = ReadTarEntries(tar)

    assert.deepEqual(entries.map((e) => e.name), [
        "usr/lib/python3.11/__pycache__/",
        "usr/share/doc/pacote/muito/fundo/LEIAME"
    ])
})

test("o teto rejeita com 413 em vez de derrubar o processo", async () => {
    const grande = ComoFluxo(Buffer.alloc(4096), 512)

    await assert.rejects(
        StreamToBuffer(grande, { limiteEmBytes: 1024, descricao: "O arquivo pedido" }),
        (erro) => {
            assert.equal(erro.code, "CONTENT_TOO_LARGE")
            assert.equal(erro.statusCode, 413)
            assert.match(erro.message, /O arquivo pedido/)
            return true
        }
    )
})

test("abaixo do teto o conteúdo continua chegando inteiro", async () => {
    const conteudo = Buffer.from("conteúdo pequeno", "utf-8")

    const resultado = await StreamToBuffer(ComoFluxo(conteudo, 3), { limiteEmBytes: 1024 })

    assert.deepEqual(resultado, conteudo)
})

test("erro do fluxo vira rejeição, e uma só", async () => {
    const fluxo = new Readable({ read() { this.destroy(new Error("socket caiu")) } })

    await assert.rejects(StreamToBuffer(fluxo), /socket caiu/)
})
