const { test } = require("node:test")
const assert = require("node:assert")
const os = require("os")
const path = require("path")
const fs = require("fs")

const InitializeInstanceStore = require("../src/InitializeInstanceStore")

// Esta lib declara sequelize/sqlite3 mas não tem node_modules próprio no repo
// (as dependências vêm no provisionamento). Para rodar o teste aqui:
//   NODE_PATH=../workspace-store.lib/node_modules npm test
//
// O `npm test` carrega a resolução de TypeScript antes: a fonte é .ts, e sem
// ela o `require("../src/InitializeInstanceStore")` acima não acha nada.

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `instance-store-test-${process.pid}`)

// IEXP-25: um processo que o daemon NÃO lançou precisa existir no monitor —
// com a identidade que responde "esta é a versão mais nova?".
test("AttachExternal registra instância externa com identidade e a limpa pelo pid", async () => {
    fs.mkdirSync(TMP, { recursive: true })
    const store = InitializeInstanceStore(path.join(TMP, "instances.sqlite"))
    await store.ConnectAndSync()

    const identity = {
        packagePath: "/tmp/pacote-x", version: "0.0.7", origin: "source",
        executablePath: "/usr/bin/node", branch: "main", commit: "abc1234"
    }
    const attached = await store.AttachExternal({
        instanceId: "ext-1", packagePath: "/tmp/pacote-x",
        pid: process.pid, launchedBy: "attach", identity
    })

    assert.equal(attached.kind, "external")
    assert.equal(attached.status, "RUNNING")
    assert.deepEqual(attached.identity, identity, "a identidade volta desserializada")

    const running = await store.ListRunning()
    assert.equal(running.length, 1)
    assert.equal(running[0].identity.version, "0.0.7")

    // Duas sessões de IA podem ter dois MCPs do mesmo pacote no ar.
    await store.AttachExternal({ instanceId: "ext-2", packagePath: "/tmp/pacote-x", pid: process.pid })
    assert.equal((await store.ListRunning()).length, 2, "externa não sobrescreve a anterior")

    // Morreu sem detach: o Reconcile derruba pelo pid (não fica fantasma).
    const { adopted, cleaned } = await store.Reconcile({ IsProcessAlive: (pid) => pid === process.pid })
    assert.equal(adopted.length, 2, "processo vivo é readotado")
    assert.equal(cleaned.length, 0)

    const morto = await store.Reconcile({ IsProcessAlive: () => false })
    assert.equal(morto.cleaned.length, 2, "processo morto vira STOPPED")
    assert.equal((await store.ListRunning()).length, 0)

    // Detach explícito continua funcionando (encerramento imediato).
    await store.AttachExternal({ instanceId: "ext-3", packagePath: "/tmp/pacote-x", pid: process.pid })
    assert.equal(await store.MarkStopped({ instanceId: "ext-3" }), true)
    assert.equal((await store.ListRunning()).length, 0)
})
