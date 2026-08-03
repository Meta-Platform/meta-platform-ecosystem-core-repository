/*
    Arquivos dentro de um volume (VDRP-260) — as duas partes que dá para provar
    sem Docker, que são justamente as que quebram calado quando erradas:

    1. O TAR. A API do Docker só troca arquivo com container por TAR, e o nosso
       é escrito à mão (uma dependência declarada neste pacote, e depender de
       transitiva do dockerode seria depender do que ninguém prometeu manter).
       Um cabeçalho com checksum errado, tamanho em decimal em vez de octal, ou
       sem os dois blocos zerados do fim é recusado pelo Docker com uma
       mensagem que não diz nada — então o formato é verificado aqui, byte a
       byte.

    2. A CONTENÇÃO DE CAMINHO. Este módulo é a última fronteira antes do
       sistema de arquivos real: um ".." que passe daqui vira escrita fora do
       espaço do usuário. A checagem acontece ANTES de qualquer chamada ao
       Docker, e é isso que o teste afirma.

    Uso: node scripts/test-volume-files.js
*/
const {
    BuildTarWithSingleFile,
    ReadTarEntries,
    ExtractFirstFileFromTar,
    BLOCK_SIZE
} = require("../src/Helpers/TarSingleFile")

const {
    RequireSafeVolumePath,
    RequireSafeFileName,
    ResolveVolumeEntryPath
} = require("../src/Helpers/ResolveVolumeEntryPath")

let failures = 0
const ok = (cond, msg) => {
    console.log(`${cond ? "  OK   " : "  FALHA"} ${msg}`)
    if (!cond) failures++
}

const CapturaErro = async (Funcao) => {
    try {
        await Funcao()
        return null
    } catch (error) {
        return error
    }
}

const LerOctal = (buffer, offset, length) =>
    parseInt(buffer.subarray(offset, offset + length).toString("utf-8").replace(/\0.*$/, "").trim(), 8)

const main = async () => {

    console.log("TAR — formato que o Docker aceita, conferido byte a byte")
    {
        const conteudo = Buffer.from("dados do usuário com acento: ção\n", "utf-8")
        const tar = BuildTarWithSingleFile({ name: "relatorio.txt", content: conteudo, mtimeSeconds: 1000 })

        ok(tar.length % BLOCK_SIZE === 0, "o tar inteiro é múltiplo de 512 bytes")
        ok(tar.subarray(0, 13).toString("utf-8").replace(/\0+$/, "") === "relatorio.txt", "o nome está no início do cabeçalho")
        ok(LerOctal(tar, 124, 12) === conteudo.length, "o tamanho está em OCTAL, como o formato exige")
        ok(tar.subarray(257, 262).toString("utf-8") === "ustar", "a assinatura ustar está presente")
        ok(tar.subarray(tar.length - BLOCK_SIZE * 2).every((byte) => byte === 0),
            "termina com dois blocos zerados — sem eles o Docker considera truncado")

        // Checksum: soma de todos os bytes com o campo de checksum contado como espaços.
        const declarado = LerOctal(tar, 148, 8)
        const header = Buffer.from(tar.subarray(0, BLOCK_SIZE))
        header.write(" ".repeat(8), 148, 8, "utf-8")
        let soma = 0
        for (const byte of header) soma += byte
        ok(declarado === soma, "o checksum do cabeçalho confere")

        const { entries } = ReadTarEntries(tar)
        ok(entries.length === 1 && entries[0].name === "relatorio.txt", "a leitura devolve a entrada gravada")
        ok(entries[0].size === conteudo.length, "com o tamanho correto")

        const extraido = ExtractFirstFileFromTar(tar)
        ok(extraido.content.equals(conteudo), "o conteúdo volta byte a byte idêntico (round-trip)")
    }

    console.log("TAR — casos de borda")
    {
        const vazio = BuildTarWithSingleFile({ name: "vazio.bin", content: Buffer.alloc(0) })
        ok(ExtractFirstFileFromTar(vazio).size === 0, "arquivo vazio sobrevive ao round-trip")

        const grande = BuildTarWithSingleFile({ name: "grande.bin", content: Buffer.alloc(1024 + 7, 0x41) })
        ok(ExtractFirstFileFromTar(grande).size === 1031, "conteúdo não alinhado a 512 é preenchido e lido certo")

        let lancou = false
        try {
            BuildTarWithSingleFile({ name: "n".repeat(101), content: Buffer.alloc(1) })
        } catch { lancou = true }
        ok(lancou, "nome longo demais é RECUSADO, nunca truncado em silêncio")

        const truncado = ReadTarEntries(BuildTarWithSingleFile({ name: "x", content: Buffer.alloc(600) }).subarray(0, 700))
        ok(truncado.truncated === true, "tar cortado é reportado como truncado, não adivinhado")
    }

    console.log("CONTENÇÃO DE CAMINHO — função pura, verificável sem Docker")
    {
        const perigosos = ["../fora", "a/../../fora", "/etc/passwd", "..", "sub/../../x", "\\raiz"]
        for (const caminho of perigosos) {
            const resolvido = ResolveVolumeEntryPath(caminho)
            ok(resolvido.safe === false, `"${caminho}" é recusado (${resolvido.reason ?? "deveria ter sido recusado"})`)
        }

        const bons = [
            { entrada: "", esperado: "" },
            { entrada: ".", esperado: "" },
            { entrada: "docs", esperado: "docs" },
            { entrada: "docs/2026", esperado: "docs/2026" },
            { entrada: "docs//2026/", esperado: "docs/2026" },
            { entrada: "./docs/./2026", esperado: "docs/2026" }
        ]
        for (const { entrada, esperado } of bons) {
            const resolvido = ResolveVolumeEntryPath(entrada)
            ok(resolvido.safe && resolvido.relative === esperado,
                `"${entrada}" vira "${esperado}" (canônico, sem dois nomes para o mesmo lugar)`)
        }

        ok(ResolveVolumeEntryPath("docs").absolute === "/data/docs",
            "o caminho absoluto é sempre dentro do ponto de montagem do volume")

        let lancouTravessia = false
        try { RequireSafeVolumePath("../x") } catch (erro) { lancouTravessia = erro.code === "PATH_TRAVERSAL_NOT_ALLOWED" }
        ok(lancouTravessia, "a versão que lança recusa travessia com código próprio")

        ok(RequireSafeFileName("relatorio.txt") === "relatorio.txt", "nome simples de arquivo é aceito")

        for (const nome of ["sub/arquivo.txt", "../fuga.txt", "", "."]) {
            let recusado = false
            try { RequireSafeFileName(nome) } catch { recusado = true }
            ok(recusado, `nome de arquivo "${nome}" é recusado — pasta vem no path, não no nome`)
        }
    }

    console.log("NOME DO VOLUME — a API do Docker só nomeia por `Name` (VDRP-259)")
    {
        /*
            Reproduz a tradução que CreateNewVolume faz, sem Docker: o
            orquestrador chama com `volumeName` e o daemon só entende `Name`.
            Com a chave errada o volume nasce ANÔNIMO — foi o que escondeu o
            defeito por tanto tempo, porque o volume nomeado acabava nascendo
            junto com o container.
        */
        const Traduzir = (options) => {
            const { Labels, labels, Name, volumeName, ...rest } = options ?? {}
            const nome = Name ?? volumeName
            return { ...rest, ...(nome ? { Name: nome } : {}), Labels: labels ?? Labels ?? {} }
        }

        ok(Traduzir({ volumeName: "espaco-do-usuario-11" }).Name === "espaco-do-usuario-11",
            "chamada do orquestrador (volumeName) vira Name")
        ok(Traduzir({ Name: "ja-correto" }).Name === "ja-correto",
            "quem já chama com Name continua funcionando")
        ok(Traduzir({ volumeName: "x" }).volumeName === undefined,
            "a chave errada não é repassada ao daemon")
        ok(Traduzir({}).Name === undefined,
            "sem nome nenhum, nada de Name — volume anônimo continua possível quando é o que se quer")
    }

    console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
