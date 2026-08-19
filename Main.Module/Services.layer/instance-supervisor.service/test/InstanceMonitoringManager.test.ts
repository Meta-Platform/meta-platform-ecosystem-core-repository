const { test, describe } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")

/*
 * O que o supervisor faz quando o diretório de sockets MUDA.
 *
 * Duas regressões moram aqui:
 *
 *   - socket que sai do diretório tem de sair do monitoramento, senão a
 *     reconexão continua batendo nele a cada 4 s para sempre;
 *   - socket que JÁ está monitorado não pode ser mandado monitorar de novo. O
 *     manager pedia a lista inteira a cada mudança, e cada um dos já conhecidos
 *     caía no `throw` de "já está sendo monitorado", registrado como erro: com
 *     13 sockets, um único socket criado gerava 12 linhas de erro sobre nada.
 *     Foram 15 MB de log de ruído no host-agent.
 *
 * As dependências npm deste serviço vêm no provisionamento, não no repositório.
 * O manager carrega `colors`, então:
 *
 *   NODE_PATH=~/EcosystemData/npm-dependencies/node_modules npm test
 */

const InstanceMonitoringManager = require("../src/Managers/InstanceMonitoring.manager")

if (!globalThis.Log) {
    const nada = () => {}
    globalThis.Log = { info : nada, error : nada, debug : nada, warn : nada, fatal : nada, trace : nada, message : nada } as any
}

const DIRETORIO_DE_SOCKETS = "/tmp/supervisor-sockets-de-teste"

const CriarLibDouble = (implementacoes: Record<string, any>) => ({
    require : (nome: string) => implementacoes[nome]
})

/*
 * Monta o manager real com o diretório de sockets dublado: o `WatchSocketDirectory`
 * devolvido guarda o callback, e o teste passa a controlar o que o diretório
 * "mostra" a cada momento.
 */
const MontarManager = async ({ socketsIniciais }: { socketsIniciais: string[] }) => {

    let socketFileNames = [...socketsIniciais]
    let AvisarMudanca: ((socketFileNames: string[]) => void) | undefined = undefined

    /* O erro registrado é o que este teste vigia: nenhum pode aparecer. */
    const errosRegistrados: string[] = []
    const LogOriginal = globalThis.Log
    globalThis.Log = { ...LogOriginal, error : (...args: any[]) => errosRegistrados.push(args.map(String).join(" ")) } as any

    /* Cada conexão criada é uma instância que o supervisor passou a monitorar. */
    const conexoesCriadas: string[] = []
    const conexoesFechadas: string[] = []

    const CreateCommunicationInterface = async (socketFilePath: string) => {
        conexoesCriadas.push(socketFilePath)
        return {
            Close     : () => { conexoesFechadas.push(socketFilePath) },
            GetStatus : async () => "RUNNING"
        }
    }

    const manager = InstanceMonitoringManager({
        ecosystemdataHandlerService     : { GetEcosystemDataPath : () => "/tmp" },
        ecosystemDefaultsFileRelativePath : "ecosystem-defaults.json",
        jsonFileUtilitiesLib : CriarLibDouble({
            ReadJsonFile : async () => ({ ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR : DIRETORIO_DE_SOCKETS })
        }),
        supervisorLib : CriarLibDouble({
            ListSocketFilesName : async () => socketFileNames,
            /* Nunca resolve: o contrato real é o de um laço infinito. */
            WatchSocketDirectory : ({ onChangeSocketFileList }: any) => {
                AvisarMudanca = onChangeSocketFileList
                return new Promise(() => {})
            },
            /* A reconciliação não é o objeto deste teste; nada aqui é órfão. */
            InspectSocketFile : async () => ({ exists : true, isSocket : true, listening : true, connection : "ACCEPTED", evidence : "dublê" }),
            CreateCommunicationInterface
        }),
        notificationHubService : { NotifyEvent : () => {} },
        onReady : () => {}
    })

    /* `_Start` é assíncrono; o watcher só existe depois que ele passa. */
    while(!AvisarMudanca) await new Promise((r) => setImmediate(r))
    /* A conexão inicial de cada socket também é assíncrona. */
    await new Promise((r) => setImmediate(r))

    return {
        manager,
        errosRegistrados,
        conexoesCriadas,
        conexoesFechadas,
        MudarDiretorioPara : async (novaLista: string[]) => {
            socketFileNames = novaLista
            AvisarMudanca!(novaLista)
            await new Promise((r) => setImmediate(r))
        },
        /*
         * Esvaziar o diretório é o que ENCERRA o monitoramento: cada estado tem
         * um health check de 4 s por conta própria, e sem isso o processo de
         * teste não termina nunca — é o mesmo `Destroy` que o produto usa.
         */
        Encerrar : async () => {
            socketFileNames = []
            AvisarMudanca!([])
            await new Promise((r) => setImmediate(r))
            globalThis.Log = LogOriginal
        }
    }
}

describe("Reação do supervisor às mudanças no diretório de sockets", () => {

    test("socket novo entra em monitoramento sem reprocessar os que já estavam", async () => {

        const cenario = await MontarManager({ socketsIniciais : ["a.sock", "b.sock"] })

        assert.deepStrictEqual(cenario.conexoesCriadas, [
            `${DIRETORIO_DE_SOCKETS}/a.sock`,
            `${DIRETORIO_DE_SOCKETS}/b.sock`
        ], "a varredura inicial monitora o que já existe")

        await cenario.MudarDiretorioPara(["a.sock", "b.sock", "c.sock"])

        assert.deepStrictEqual(cenario.conexoesCriadas, [
            `${DIRETORIO_DE_SOCKETS}/a.sock`,
            `${DIRETORIO_DE_SOCKETS}/b.sock`,
            `${DIRETORIO_DE_SOCKETS}/c.sock`
        ], "só o socket que entrou vira conexão nova")

        assert.deepStrictEqual(cenario.errosRegistrados, [], "socket já monitorado não pode virar erro de log")

        await cenario.Encerrar()
    })

    test("socket que sai do diretório tem o monitoramento encerrado", async () => {

        const cenario = await MontarManager({ socketsIniciais : ["a.sock", "b.sock"] })

        await cenario.MudarDiretorioPara(["a.sock"])

        assert.deepStrictEqual(cenario.conexoesFechadas, [`${DIRETORIO_DE_SOCKETS}/b.sock`],
            "o canal do socket removido é FECHADO, não apenas esquecido")
        assert.deepStrictEqual(cenario.errosRegistrados, [])

        await cenario.Encerrar()
    })

})
