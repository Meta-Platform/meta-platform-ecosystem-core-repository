const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")

const {
    AUTHOR,
    CreateTemporaryRoot,
    CreateBareRepository,
    CreateWriter,
    Git,
    ListTree,
    ReadBlob,
    Put,
    CommitFromOutside
} = require("./Helpers")

const WithRepository = async (Body) => {
    const rootPath = CreateTemporaryRoot()
    try {
        await Body({ gitDirPath: CreateBareRepository(rootPath), writer: CreateWriter(rootPath), rootPath })
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true })
    }
}

const Commit = (writer, gitDirPath, changes, extra = {}) => writer.WriteCommit({
    gitDirPath, message: "mudanca", changes, author: AUTHOR, ...extra
})

test("primeiro commit num repositório vazio cria o branch e fica visível ao git", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        assert.strictEqual(await writer.ResolveBranchTip({ gitDirPath, branch: "main" }), undefined)

        const result = await Commit(writer, gitDirPath, [
            Put("metadata/package.json", '{"namespace":"@/hello.lib"}'),
            Put("src/Hello.js", "module.exports = () => \"oi\"\n")
        ])

        assert.strictEqual(result.previousHeadOid, null)
        assert.strictEqual(result.ref, "refs/heads/main")
        assert.strictEqual(result.commit.subject, "mudanca")
        assert.strictEqual(result.commit.authorName, AUTHOR.name)

        // A prova é o git lendo o que escrevemos, não a nossa própria resposta.
        assert.strictEqual(Git(gitDirPath, ["rev-parse", "refs/heads/main"]), result.commit.oid)
        assert.strictEqual(Git(gitDirPath, ["rev-parse", "HEAD"]), result.commit.oid)
        assert.deepStrictEqual(ListTree(gitDirPath), ["metadata/package.json", "src/Hello.js"])
        assert.strictEqual(Git(gitDirPath, ["log", "--format=%s", "main"]), "mudanca")
        // Commit inicial não tem pai.
        assert.strictEqual(Git(gitDirPath, ["rev-list", "--count", "main"]), "1")
    })
})

test("segundo commit encadeia no primeiro", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])
        const second = await Commit(writer, gitDirPath, [Put("a.txt", "dois\n")], { expectedHeadOid: first.commit.oid })

        assert.strictEqual(second.previousHeadOid, first.commit.oid)
        assert.strictEqual(Git(gitDirPath, ["rev-parse", `${second.commit.oid}^`]), first.commit.oid)
        assert.strictEqual(ReadBlob(gitDirPath, "a.txt").toString("utf8"), "dois\n")
        assert.strictEqual(Git(gitDirPath, ["rev-list", "--count", "main"]), "2")
    })
})

test("commit em branch com história exige saber de onde partiu", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])

        await assert.rejects(
            () => Commit(writer, gitDirPath, [Put("a.txt", "dois\n")]),
            (error) => {
                assert.strictEqual(error.code, "HEAD_ASSERTION_REQUIRED")
                assert.strictEqual(error.statusCode, 400)
                assert.strictEqual(error.currentHeadOid, first.commit.oid)
                return true
            })

        // Nada foi publicado: a ponta continua no primeiro commit.
        assert.strictEqual(Git(gitDirPath, ["rev-parse", "main"]), first.commit.oid)
    })
})

test("ponta velha no MESMO arquivo é recusada, dizendo qual arquivo conflitou", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n"), Put("b.txt", "bê\n")])
        const externalOid = CommitFromOutside(gitDirPath, { "a.txt": "de fora\n" })

        await assert.rejects(
            () => Commit(writer, gitDirPath, [Put("a.txt", "meu\n")], { expectedHeadOid: first.commit.oid }),
            (error) => {
                assert.strictEqual(error.code, "STALE_HEAD")
                assert.strictEqual(error.statusCode, 409)
                assert.strictEqual(error.currentHeadOid, externalOid)
                assert.deepStrictEqual(error.conflictingPaths, ["a.txt"])
                return true
            })

        assert.strictEqual(Git(gitDirPath, ["rev-parse", "main"]), externalOid)
        assert.strictEqual(ReadBlob(gitDirPath, "a.txt").toString("utf8"), "de fora\n")
    })
})

test("ponta velha em arquivo DIFERENTE é reaplicada sozinha na ponta nova", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])
        const externalOid = CommitFromOutside(gitDirPath, { "a.txt": "de fora\n" })

        const result = await Commit(writer, gitDirPath, [Put("b.txt", "meu\n")], { expectedHeadOid: first.commit.oid })

        // Reaplicado sobre o commit externo, sem perder nem o que veio de fora
        // nem o que a pessoa escreveu.
        assert.strictEqual(result.previousHeadOid, externalOid)
        assert.strictEqual(Git(gitDirPath, ["rev-parse", `${result.commit.oid}^`]), externalOid)
        assert.strictEqual(ReadBlob(gitDirPath, "a.txt").toString("utf8"), "de fora\n")
        assert.strictEqual(ReadBlob(gitDirPath, "b.txt").toString("utf8"), "meu\n")
    })
})

test("onStale reject recusa mesmo quando não há conflito de arquivo", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])
        CommitFromOutside(gitDirPath, { "a.txt": "de fora\n" })

        await assert.rejects(
            () => Commit(writer, gitDirPath, [Put("b.txt", "meu\n")], { expectedHeadOid: first.commit.oid, onStale: "reject" }),
            { code: "STALE_HEAD" })
    })
})

test("commit que não muda nada é recusado", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])

        await assert.rejects(
            () => Commit(writer, gitDirPath, [Put("a.txt", "um\n")], { expectedHeadOid: first.commit.oid }),
            (error) => {
                assert.strictEqual(error.code, "EMPTY_COMMIT")
                assert.strictEqual(error.statusCode, 409)
                return true
            })

        assert.strictEqual(Git(gitDirPath, ["rev-list", "--count", "main"]), "1")

        // allowEmpty é a saída explícita para quem realmente quer o commit vazio.
        const forced = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")],
            { expectedHeadOid: first.commit.oid, allowEmpty: true })
        assert.strictEqual(Git(gitDirPath, ["rev-list", "--count", "main"]), "2")
        assert.strictEqual(Git(gitDirPath, ["rev-parse", `${forced.commit.oid}^{tree}`]),
            Git(gitDirPath, ["rev-parse", `${first.commit.oid}^{tree}`]))
    })
})

test("conteúdo binário volta byte a byte idêntico", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        // 2 MiB pseudoaleatórios determinísticos, com NUL no começo (o que faz o
        // git tratar como binário) e byte alto no fim.
        const original = Buffer.alloc(2 * 1024 * 1024)
        for (let i = 0; i < original.length; i++) original[i] = (i * 31 + (i >> 8)) & 0xff
        original[0] = 0
        original[original.length - 1] = 0xff

        await Commit(writer, gitDirPath, [{ op: "put", path: "assets/imagem.png", contentBase64: original.toString("base64") }])

        const roundTrip = ReadBlob(gitDirPath, "assets/imagem.png")
        assert.strictEqual(roundTrip.length, original.length)
        assert.ok(roundTrip.equals(original), "o binário voltou diferente do que entrou")
    })
})

test("caminho incomum sobrevive ao formato do --index-info", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        /*
            `update-index --index-info` recebe uma LINHA por entrada, no formato
            `<modo> SP <oid> TAB <caminho>`. Ou seja: o lote inteiro é texto
            delimitado, e um caminho com o delimitador dentro gravaria o arquivo
            com outro nome — em silêncio, porque o git aceitaria a linha
            malformada como se fosse outra entrada.

            TAB e quebra de linha são recusados na normalização, que é onde essa
            garantia tem que estar. O que este teste cobre é o resto: vírgula,
            espaço e acento não têm nada de especial para este formato, e
            precisam atravessar intactos.
        */
        const paths = ["docs/lista,de,itens.md", "a b/c d.txt", "docs/ação.md"]
        await Commit(writer, gitDirPath, paths.map((path) => Put(path, `conteudo de ${path}\n`)))

        assert.deepStrictEqual(ListTree(gitDirPath).sort(), paths.slice().sort())
        for (const path of paths) {
            assert.strictEqual(ReadBlob(gitDirPath, path).toString("utf8"), `conteudo de ${path}\n`)
        }
    })
})

test("bit de executável é preservado ao editar e mudável quando pedido", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [{ ...Put("run.sh", "#!/bin/sh\necho um\n"), mode: "100755" }])
        assert.match(Git(gitDirPath, ["ls-tree", "main", "--", "run.sh"]), /^100755 blob/)

        const second = await Commit(writer, gitDirPath, [Put("run.sh", "#!/bin/sh\necho dois\n")],
            { expectedHeadOid: first.commit.oid })
        assert.match(Git(gitDirPath, ["ls-tree", "main", "--", "run.sh"]), /^100755 blob/,
            "editar um script não pode tirar o bit de executável")

        await Commit(writer, gitDirPath, [{ ...Put("run.sh", "#!/bin/sh\necho tres\n"), mode: "100644" }],
            { expectedHeadOid: second.commit.oid })
        assert.match(Git(gitDirPath, ["ls-tree", "main", "--", "run.sh"]), /^100644 blob/)
    })
})

test("apaga arquivo, apaga diretório recursivo e recusa diretório sem recursive", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [
            Put("README.md", "raiz\n"),
            Put("src/App.js", "app\n"),
            Put("src/util/Helper.js", "helper\n")
        ])

        await assert.rejects(
            () => Commit(writer, gitDirPath, [{ op: "delete", path: "src" }], { expectedHeadOid: first.commit.oid }),
            { code: "RECURSIVE_REQUIRED", statusCode: 400 })

        const second = await Commit(writer, gitDirPath,
            [{ op: "delete", path: "src", recursive: true }], { expectedHeadOid: first.commit.oid })
        assert.deepStrictEqual(ListTree(gitDirPath), ["README.md"])
        assert.strictEqual(second.applied[0].removed, 2)

        // Apagar o que já não existe não é erro; o commit vazio é quem reporta.
        await assert.rejects(
            () => Commit(writer, gitDirPath, [{ op: "delete", path: "src/App.js" }], { expectedHeadOid: second.commit.oid }),
            { code: "EMPTY_COMMIT" })
    })
})

test("move arquivo e move diretório inteiro preservando conteúdo", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [
            Put("src/App.js", "app\n"),
            Put("src/util/Helper.js", "helper\n")
        ])

        const second = await Commit(writer, gitDirPath,
            [{ op: "move", path: "src", newPath: "lib" }], { expectedHeadOid: first.commit.oid })

        assert.deepStrictEqual(ListTree(gitDirPath).sort(), ["lib/App.js", "lib/util/Helper.js"])
        assert.strictEqual(ReadBlob(gitDirPath, "lib/util/Helper.js").toString("utf8"), "helper\n")
        assert.strictEqual(second.applied[0].moved, 2)

        await assert.rejects(
            () => Commit(writer, gitDirPath, [{ op: "move", path: "nao/existe.js", newPath: "x.js" }],
                { expectedHeadOid: second.commit.oid }),
            { code: "SOURCE_NOT_FOUND", statusCode: 400 })
    })
})

test("expectedOid por arquivo separa conflito de conteúdo de avanço da ponta", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])
        const blobOid = Git(gitDirPath, ["rev-parse", "main:a.txt"])

        // Oid certo: passa.
        const second = await Commit(writer, gitDirPath, [{ ...Put("a.txt", "dois\n"), expectedOid: blobOid }],
            { expectedHeadOid: first.commit.oid })

        // Oid velho: recusa apontando o arquivo.
        await assert.rejects(
            () => Commit(writer, gitDirPath, [{ ...Put("a.txt", "tres\n"), expectedOid: blobOid }],
                { expectedHeadOid: second.commit.oid }),
            (error) => {
                assert.strictEqual(error.code, "FILE_CHANGED")
                assert.strictEqual(error.statusCode, 409)
                assert.strictEqual(error.conflicts[0].path, "a.txt")
                assert.strictEqual(error.conflicts[0].expectedOid, blobOid)
                return true
            })

        // `null` afirma "estou criando": recusa se o arquivo já existe.
        await assert.rejects(
            () => Commit(writer, gitDirPath, [{ ...Put("a.txt", "quatro\n"), expectedOid: null }],
                { expectedHeadOid: second.commit.oid }),
            { code: "FILE_CHANGED" })

        // E passa quando de fato não existe.
        await Commit(writer, gitDirPath, [{ ...Put("novo.txt", "novo\n"), expectedOid: null }],
            { expectedHeadOid: second.commit.oid })
        assert.strictEqual(ReadBlob(gitDirPath, "novo.txt").toString("utf8"), "novo\n")
    })
})

test("mensagem com acento, aspas e quebra de linha chega íntegra", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const message = 'feat(coisa): "aspas", acentuação e ção\n\nCorpo com -- traço e $VARIAVEL.\n'
        await Commit(writer, gitDirPath, [Put("a.txt", "um\n")], { message })

        assert.strictEqual(Git(gitDirPath, ["log", "-1", "--format=%s", "main"]),
            'feat(coisa): "aspas", acentuação e ção')
        assert.match(Git(gitDirPath, ["log", "-1", "--format=%b", "main"]), /traço e \$VARIAVEL/)
    })
})

test("scratch não deixa lixo, nem no sucesso nem na recusa", async () => {
    await WithRepository(async ({ gitDirPath, writer, rootPath }) => {
        const scratchRootPath = `${rootPath}/scratch`

        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])
        assert.deepStrictEqual(fs.readdirSync(scratchRootPath), [])

        await assert.rejects(() => Commit(writer, gitDirPath, [Put("a.txt", "um\n")], { expectedHeadOid: first.commit.oid }))
        assert.deepStrictEqual(fs.readdirSync(scratchRootPath), [],
            "um índice temporário sobrando é o que trava a tentativa seguinte")
    })
})

test("branches: cria, lista e apaga com compare-and-swap", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        const first = await Commit(writer, gitDirPath, [Put("a.txt", "um\n")])

        const created = await writer.CreateBranch({ gitDirPath, name: "trabalho", fromRef: "main" })
        assert.strictEqual(created.oid, first.commit.oid)
        assert.deepStrictEqual((await writer.ListBranches({ gitDirPath })).map(({ name }) => name).sort(),
            ["main", "trabalho"])

        await assert.rejects(() => writer.CreateBranch({ gitDirPath, name: "trabalho", fromRef: "main" }),
            { code: "BRANCH_EXISTS" })

        // Commitar no branch novo não move o main.
        await Commit(writer, gitDirPath, [Put("b.txt", "bê\n")],
            { branch: "trabalho", expectedHeadOid: first.commit.oid })
        assert.strictEqual(Git(gitDirPath, ["rev-parse", "main"]), first.commit.oid)
        assert.notStrictEqual(Git(gitDirPath, ["rev-parse", "trabalho"]), first.commit.oid)

        await assert.rejects(
            () => writer.DeleteBranch({ gitDirPath, name: "trabalho", expectedOid: first.commit.oid }),
            { code: "STALE_HEAD" })

        await writer.DeleteBranch({ gitDirPath, name: "trabalho" })
        assert.deepStrictEqual((await writer.ListBranches({ gitDirPath })).map(({ name }) => name), ["main"])
    })
})

test("nome de branch e de repositório inválidos são recusados antes do git", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        for (const branch of ["-x", "a..b", "main.lock", "", "refs/heads/main "]) {
            await assert.rejects(() => Commit(writer, gitDirPath, [Put("a.txt", "um\n")], { branch }),
                { code: "INVALID_BRANCH" })
        }
        await assert.rejects(
            () => Commit(writer, gitDirPath, [Put("a.txt", "um\n")], { expectedHeadOid: "nao-e-oid" }),
            { code: "INVALID_HEAD_OID" })
    })
})

test("autor é obrigatório porque commit-tree sem identidade falha", async () => {
    await WithRepository(async ({ gitDirPath, writer }) => {
        await assert.rejects(
            () => writer.WriteCommit({ gitDirPath, message: "m", changes: [Put("a.txt", "um\n")] }),
            { code: "INVALID_AUTHOR" })
        await assert.rejects(
            () => writer.WriteCommit({ gitDirPath, message: "m", changes: [Put("a.txt", "um\n")], author: { name: "x" } }),
            { code: "INVALID_AUTHOR" })
    })
})
