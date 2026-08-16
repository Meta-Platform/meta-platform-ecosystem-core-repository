const { test } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")
const os = require("os") as typeof import("os")
const path = require("path") as typeof import("path")
const fs = require("fs") as typeof import("fs")

// As dependências npm deste serviço vêm no provisionamento, não no repositório.
// Para rodar aqui:
//   NODE_PATH=~/EcosystemData/npm-dependencies/node_modules:\
//             ../../Libraries.layer/workspace-store.lib/node_modules npm test
//
// O `npm test` carrega a resolução de TypeScript antes: a fonte é .ts.
const EcosystemManager = require("../src/Managers/Ecosystem.manager")

/*
 * IEXP/VDRP-249 — app in-process lançado pelo daemon sumia de list-instances um
 * segundo depois de subir.
 *
 * O teste monta o manager real com o InstanceStore real (sqlite temporário) e
 * dublês para o resto: o que está sob exame é a decisão de ListInstances sobre
 * uma instância `app` que ainda não tem application-task.
 *
 * Para rodar:  NODE_PATH=<node_modules com sequelize/sqlite3> node --test test/
 */

const INSTANCE_STORE_LIB = path.resolve(__dirname, "../../../Libraries.layer/instance-store.lib")

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `ecosystem-manager-test-${process.pid}`)

const PACOTE = "/repos/AlgumRepo/Alguma.Module/Applications.layer/algum-app.app"

/* O manager registra por Log global; nos testes ele não existe. */
if (!globalThis.Log) {
    const nada = () => {}
    globalThis.Log = { info : nada, error : nada, debug : nada, warn : nada, fatal : nada, trace : nada, message : nada } as any
}

const CreateLibDouble = (implementacoes: Record<string, any>) => ({
    require : (nome: string) => {
        if (!(nome in implementacoes)) return () => {}
        return implementacoes[nome]
    }
})

const CreateManager = ({ applicationTasks = [], executions = {} }: {
    applicationTasks ?: any[],
    executions       ?: Record<string, any>
}) => {

    fs.mkdirSync(TMP, { recursive : true })

    const instanceStoreFilePath = path.join(TMP, `instances-${Math.floor(process.hrtime()[1])}.sqlite`)

    /* O InstanceStore é o REAL: o que interessa provar é o efeito no registro. */
    const InitializeInstanceStore = require(path.join(INSTANCE_STORE_LIB, "src/InitializeInstanceStore"))

    const environmentRuntimeService = {
        ListApplicationTask        : () => applicationTasks,
        GetExecutionData           : (executionId: any) => executions[String(executionId)],
        AddExecutionStatusListener : () => {},
        ListRunningEnvironments    : () => [],
        ExecuteEnvironment         : async () => 0,
        StopExecution              : () => {},
        StopPackage                : () => ({ stopped : false })
    }

    let instanceStoreCapturado: any = null

    const manager = EcosystemManager({
        dependencyGraphBuilderLib  : CreateLibDouble({}),
        repositoryConfigHandlerLib : CreateLibDouble({ "PrepareRepositoriesFileJson" : async () => {} }),
        environmentHandlerLib      : CreateLibDouble({}),
        resolvePackageNameLib      : CreateLibDouble({}),
        metadataHierarchyHandlerLib: CreateLibDouble({}),
        jsonFileUtilitiesLib       : CreateLibDouble({}),
        instanceStoreLib           : CreateLibDouble({
            "InitializeInstanceStore" : (filePath: string) => {
                instanceStoreCapturado = InitializeInstanceStore(filePath)
                return instanceStoreCapturado
            }
        }),
        processMetricsLib          : null,
        resourceParamsHandlerLib   : null,
        ecosystemDefaultsHandlerLib: CreateLibDouble({ "Get" : () => ({}) }),
        repositoryManagerService   : {},
        environmentRuntimeService,
        taskExecutorMachineService : { ListTasks : () => applicationTasks },
        PKG_CONF_DIRNAME_METADATA  : "metadata",
        ECO_DIRPATH_INSTALL_DATA   : TMP,
        REPOS_CONF_FILENAME_REPOS_DATA : "repos.json",
        REPOS_CONF_EXT_GROUP_DIR   : ".group",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES : ".dependencies",
        ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA : "graph.json",
        configurationsDirName      : "config-files",
        ecosystemDefaultsFileName  : "ecosystem-defaults.json",
        instanceStoreFilePath,
        socket                     : null,
        onReady                    : () => {}
    })

    return { manager, GetInstanceStore : () => instanceStoreCapturado }
}

/* Registra uma instância `app` já em execução, do jeito que RunPackage faz. */
const RegistrarAppEmExecucao = async (instanceStore, { instanceId, executionId }) => {
    await instanceStore.ConnectAndSync()
    await instanceStore.RegisterLaunch({
        instanceId,
        packagePath : PACOTE,
        kind        : instanceStore.KIND.APP,
        executionId,
        launchedBy  : "teste"
    })
}

// O caso do card: o app foi lançado, a execução está de pé, mas a
// application-task ainda não apareceu no task-executor.
test("app cuja execução está viva continua listado mesmo sem application-task", async () => {

    const { manager, GetInstanceStore } = CreateManager({
        applicationTasks : [],
        executions       : { "0" : { executionId : 0, status : "RUNNING" } }
    })

    const instanceStore = GetInstanceStore()
    await RegistrarAppEmExecucao(instanceStore, { instanceId : "i-viva", executionId : 0 })

    const listadas = await manager.ListInstances()

    assert.strictEqual(listadas.length, 1, "a instância não pode sumir enquanto a execução está de pé")
    assert.strictEqual(listadas[0].instanceId, "i-viva")
    assert.strictEqual(listadas[0].status, "RUNNING")

    const registro = await instanceStore.Get({ instanceId : "i-viva" })
    assert.notStrictEqual(registro.status, "STOPPED", "e não pode ser marcada como parada no registro")
})

// `executionId` 0 é o da PRIMEIRA execução do daemon — e é falsy. Era o valor
// do lançamento relatado no card.
test("executionId zero é tratado como execução existente, não como ausência", async () => {

    const { manager, GetInstanceStore } = CreateManager({
        applicationTasks : [],
        executions       : { "0" : { executionId : 0, status : "STARTING" } }
    })

    await RegistrarAppEmExecucao(GetInstanceStore(), { instanceId : "i-zero", executionId : 0 })

    const listadas = await manager.ListInstances()

    assert.strictEqual(listadas.length, 1, "executionId 0 não pode ser confundido com 'sem execução'")
    assert.strictEqual(listadas[0].status, "STARTING")
})

test("app com execução TERMINATED é marcado como parado e sai da lista", async () => {

    const { manager, GetInstanceStore } = CreateManager({
        applicationTasks : [],
        executions       : { "0" : { executionId : 0, status : "TERMINATED" } }
    })

    const instanceStore = GetInstanceStore()
    await RegistrarAppEmExecucao(instanceStore, { instanceId : "i-morta", executionId : 0 })

    const listadas = await manager.ListInstances()

    assert.strictEqual(listadas.length, 0, "execução encerrada não continua listada")

    const registro = await instanceStore.Get({ instanceId : "i-morta" })
    assert.strictEqual(registro.status, "STOPPED", "o registro é corrigido, como antes")
})

// O taskId nunca era amarrado: no RunPackage a task ainda não existe.
test("taskId é amarrado na primeira listagem em que a application-task aparece", async () => {

    const { manager, GetInstanceStore } = CreateManager({
        applicationTasks : [{ taskId : 42, status : "ACTIVE", objectLoaderType : "app", staticParameters : { rootPath : PACOTE } }],
        executions       : { "0" : { executionId : 0, status : "RUNNING" } }
    })

    const instanceStore = GetInstanceStore()
    await RegistrarAppEmExecucao(instanceStore, { instanceId : "i-task", executionId : 0 })

    const antes = await instanceStore.Get({ instanceId : "i-task" })
    assert.ok(antes.taskId === null || antes.taskId === undefined, "nasce sem taskId")

    const listadas = await manager.ListInstances()

    assert.strictEqual(listadas[0].taskId, 42)
    assert.strictEqual(listadas[0].status, "ACTIVE", "com task, quem manda no status é a task")

    const depois = await instanceStore.Get({ instanceId : "i-task" })
    assert.strictEqual(String(depois.taskId), "42", "o vínculo fica registrado, não só no retorno")
})
