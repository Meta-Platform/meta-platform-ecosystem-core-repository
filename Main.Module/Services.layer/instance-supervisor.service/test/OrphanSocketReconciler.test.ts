const { test, describe } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")
const os     = require("os") as typeof import("os")
const path   = require("path") as typeof import("path")
const fs     = require("fs") as typeof import("fs")
const net    = require("net") as typeof import("net")
const { spawn } = require("child_process") as typeof import("child_process")

/*
 * Faxina de sockets órfãos — o arquivo `.sock` que sobrevive à instância.
 *
 * Os sockets aqui são REAIS: um servidor unix de verdade para o caso vivo, e um
 * processo filho morto a SIGKILL para o caso órfão, que é exatamente como os
 * arquivos de 9 de junho e 7 de julho apareceram no diretório de supervisão.
 * Dublê nenhum provaria o que interessa provar, porque o critério de órfão
 * consulta o KERNEL (`/proc/net/unix` e o veredito do `connect`).
 *
 * Para rodar:  npm test
 */

const SUPERVISOR_LIB = path.resolve(__dirname, "../../../../../essential-repository/Commons.Module/Libraries.layer/supervisor.lib")

const InspectSocketFile   = require(path.join(SUPERVISOR_LIB, "src/InspectSocketFile"))
const ListSocketFilesName = require(path.join(SUPERVISOR_LIB, "src/ListSocketFilesName"))

const CreateOrphanSocketReconciler = require("../src/Helpers/CreateOrphanSocketReconciler")

/* O helper registra por `Log` global; no teste ele não existe. */
if (!globalThis.Log) {
    const nada = () => {}
    globalThis.Log = { info : nada, error : nada, debug : nada, warn : nada, fatal : nada, trace : nada, message : nada } as any
}

/* Caminho de socket unix tem teto de ~107 bytes: o diretório precisa ser curto. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "sock-rec-"))

const _CaminhoDoSocket = (nome: string) => path.join(TMP, nome)

/* Socket VIVO: servidor unix escutando de verdade, neste mesmo processo. */
const _CriarSocketVivo = (nome: string): Promise<{ socketFilePath: string, Encerrar: () => Promise<void> }> =>
    new Promise((resolve, reject) => {
        const socketFilePath = _CaminhoDoSocket(nome)
        const server = net.createServer(() => {})
        server.on("error", reject)
        server.listen(socketFilePath, () => resolve({
            socketFilePath,
            Encerrar : () => new Promise<void>((r) => server.close(() => r()))
        }))
    })

/*
 * Socket ÓRFÃO: um processo filho sobe o listener e leva SIGKILL. Sem chance de
 * limpar, o arquivo fica no disco sem dono — o caso real que este código existe
 * para resolver.
 */
const _CriarSocketOrfao = (nome: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const socketFilePath = _CaminhoDoSocket(nome)
        const filho = spawn(process.execPath, [
            "-e",
            `require("net").createServer(()=>{}).listen(${JSON.stringify(socketFilePath)}, () => console.log("pronto"))`
        ])
        let saida = ""
        filho.stdout.on("data", (chunk: any) => {
            saida += String(chunk)
            if(!saida.includes("pronto")) return
            filho.kill("SIGKILL")
            filho.on("exit", () => {
                // O arquivo TEM de continuar lá: é essa a premissa do teste.
                assert.ok(fs.existsSync(socketFilePath), "o socket órfão deveria ter sobrevivido ao processo morto")
                resolve(socketFilePath)
            })
        })
        filho.on("error", reject)
    })

const CriarReconciliador = ({
    IsInstanceConnected   = () => false,
    minimumAgeMs          = 0,
    confirmationsRequired = 2
}: {
    IsInstanceConnected   ?: (socketFilePath: string) => boolean
    minimumAgeMs          ?: number
    confirmationsRequired ?: number
} = {}) => {

    const removidos: string[] = []

    const reconciliador = CreateOrphanSocketReconciler({
        GetSocketsDirPath : () => TMP,
        IsInstanceConnected,
        helpers           : { ListSocketFilesName, InspectSocketFile },
        OnOrphanRemoved   : ({ socketFilePath }: { socketFilePath: string }) => removidos.push(socketFilePath),
        minimumAgeMs,
        confirmationsRequired
    })

    return { reconciliador, removidos }
}

describe("Reconciliação de sockets órfãos", () => {

    test("socket de instância VIVA nunca é removido, por mais rodadas que passem", async () => {

        const { socketFilePath, Encerrar } = await _CriarSocketVivo("viva.sock")

        // A configuração mais agressiva possível: sem período de graça e com uma
        // única confirmação. Se houvesse um caminho para apagar socket vivo, ele
        // apareceria aqui.
        const { reconciliador, removidos } = CriarReconciliador({ minimumAgeMs: 0, confirmationsRequired: 1 })

        await reconciliador.RunOnce()
        await reconciliador.RunOnce()
        await reconciliador.RunOnce()

        assert.deepStrictEqual(removidos, [], "nenhum socket com listener vivo pode ser removido")
        assert.ok(fs.existsSync(socketFilePath), "o arquivo da instância viva continua no disco")

        await Encerrar()
    })

    test("socket de instância MORTA é removido, depois de confirmado", async () => {

        const socketFilePath = await _CriarSocketOrfao("morta.sock")

        const { reconciliador, removidos } = CriarReconciliador({ minimumAgeMs: 0, confirmationsRequired: 2 })

        await reconciliador.RunOnce()
        assert.ok(fs.existsSync(socketFilePath), "uma única rodada NÃO autoriza a remoção")
        assert.deepStrictEqual(removidos, [])

        await reconciliador.RunOnce()
        assert.strictEqual(fs.existsSync(socketFilePath), false, "confirmado em duas rodadas, o órfão é removido")
        assert.deepStrictEqual(removidos, [socketFilePath])
    })

    test("socket recém-criado sem ninguém escutando é protegido pelo período de graça", async () => {

        // Instância subindo: o arquivo nasce antes de qualquer coisa responder
        // por ele. O período de graça existe para esse instante.
        const socketFilePath = await _CriarSocketOrfao("subindo.sock")

        const { reconciliador, removidos } = CriarReconciliador({ minimumAgeMs: 60000, confirmationsRequired: 1 })

        await reconciliador.RunOnce()
        await reconciliador.RunOnce()
        await reconciliador.RunOnce()

        assert.deepStrictEqual(removidos, [], "dentro do período de graça nada é removido")
        assert.ok(fs.existsSync(socketFilePath), "o socket recém-criado continua no disco")

        fs.unlinkSync(socketFilePath)
    })

    test("socket que o supervisor tem conectado é vetado mesmo sem listener no kernel", async () => {

        const socketFilePath = await _CriarSocketOrfao("conectada.sock")

        const { reconciliador, removidos } = CriarReconciliador({
            IsInstanceConnected   : () => true,
            minimumAgeMs          : 0,
            confirmationsRequired : 1
        })

        await reconciliador.RunOnce()
        await reconciliador.RunOnce()

        assert.deepStrictEqual(removidos, [], "conversa viva com a instância veta a remoção")
        assert.ok(fs.existsSync(socketFilePath))

        fs.unlinkSync(socketFilePath)
    })

    test("arquivo recriado zera a suspeita: a contagem segue o inode, não o nome", async () => {

        const socketFilePath = await _CriarSocketOrfao("recriada.sock")

        const { reconciliador, removidos } = CriarReconciliador({ minimumAgeMs: 0, confirmationsRequired: 2 })

        await reconciliador.RunOnce()
        assert.ok(fs.existsSync(socketFilePath))

        // O nome volta, o arquivo é outro: uma instância nova assumiu o lugar da
        // que morreu. A confirmação anterior não vale para este arquivo.
        fs.unlinkSync(socketFilePath)
        const recriado = await _CriarSocketOrfao("recriada.sock")
        assert.notStrictEqual(fs.statSync(recriado).ino, undefined)

        await reconciliador.RunOnce()
        assert.ok(fs.existsSync(recriado), "a suspeita do arquivo anterior não pode ser herdada pelo novo")
        assert.deepStrictEqual(removidos, [])

        await reconciliador.RunOnce()
        assert.strictEqual(fs.existsSync(recriado), false, "confirmado duas vezes contra o MESMO arquivo, o órfão sai")
    })

})

describe("Inspeção do arquivo de socket", () => {

    test("distingue positivamente listener vivo de arquivo abandonado", async () => {

        const { socketFilePath: vivo, Encerrar } = await _CriarSocketVivo("inspecao-viva.sock")
        const morto = await _CriarSocketOrfao("inspecao-morta.sock")

        const inspecaoViva = await InspectSocketFile(vivo)
        assert.strictEqual(inspecaoViva.isSocket, true)
        assert.strictEqual(inspecaoViva.listening, true, "o kernel registra o listener do servidor vivo")
        assert.strictEqual(inspecaoViva.connection, "ACCEPTED", "o kernel aceita a conexão de teste")
        assert.strictEqual(inspecaoViva.listenerPid, process.pid, "o dono do socket é este processo de teste")
        assert.strictEqual(inspecaoViva.listenerAlive, true)

        const inspecaoMorta = await InspectSocketFile(morto)
        assert.strictEqual(inspecaoMorta.isSocket, true)
        assert.strictEqual(inspecaoMorta.listening, false, "nenhum listener registrado no kernel para o arquivo abandonado")
        assert.strictEqual(inspecaoMorta.connection, "REFUSED", "ECONNREFUSED é a afirmação de que não há ninguém do outro lado")
        assert.strictEqual(inspecaoMorta.listenerPid, undefined)

        await Encerrar()
        fs.unlinkSync(morto)
    })

    test("arquivo inexistente é relatado como ausente, nunca como órfão", async () => {
        const inspecao = await InspectSocketFile(_CaminhoDoSocket("nunca-existiu.sock"))
        assert.strictEqual(inspecao.exists, false)
        assert.strictEqual(inspecao.connection, "MISSING")
    })

})

process.on("exit", () => {
    try { fs.rmSync(TMP, { recursive : true, force : true }) } catch(e) { /* melhor esforço */ }
})
