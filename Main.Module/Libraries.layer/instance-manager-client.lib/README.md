# instance-manager-client.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/instance-manager-client.lib`
- **Localização:** `Main.Module/Libraries.layer/instance-manager-client.lib`

## Propósito

Cliente reutilizável do **Instance Manager** — o daemon `executor-manager`
(`ecosystem-instance-manager.app`) que centraliza a execução de pacotes e
aplicações do ecossistema.

Esta lib é o ponto único pelo qual os painéis passam a pedir execução em vez de
spawnar `run package` diretamente. É injetada como `instanceManagerClientLib`
em:

- `execution-manager.webservice` (my-desktop)
- `ecosystem-control-panel.webservice` (eco-panel)
- `instance-executor-control-panel.webservice` (gerenciador de processos/tarefas)

A comunicação é feita por HTTP sobre o **Unix socket** do daemon, reaproveitando
o mesmo mecanismo do CLI `executor` (`mount-api.lib`): a superfície de APIs é
descoberta dinamicamente a partir dos `.api.json` publicados pelo daemon.

## Uso

```js
const CreateInstanceManagerClient = instanceManagerClientLib.require("CreateInstanceManagerClient")

const instanceManager = CreateInstanceManagerClient({
    platformApplicationSocketPath: "<EcosystemData>/sockets/ecosystem-instance-manager.app.sock"
})

if(await instanceManager.IsAvailable())
    await instanceManager.RunPackage({ packagePath })
```

## Exports (`src/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `CreateInstanceManagerClient.js` | Fábrica do cliente do daemon; expõe execução de pacotes, tarefas, ambientes e streams. |

### Superfície do cliente

| Método | Daemon (controller) | Descrição |
|--------|---------------------|-----------|
| `IsAvailable()` | — | Verifica se o daemon está de pé. |
| `RunPackage({ packagePath, startupParams })` | EcosystemManager | Executa um pacote. |
| `ListPackages()` | EcosystemManager | Lista pacotes supervisionados. |
| `OpenPackageListStream()` | EcosystemManager (WS) | Stream da lista de pacotes. |
| `ListTasks()` | TaskExecutorMachine | Lista tarefas. |
| `GetTask({ taskId })` | TaskExecutorMachine | Detalha uma tarefa. |
| `CreateTasks({ executionParams })` | TaskExecutorMachine | Cria tarefas. |
| `OpenTaskStatusStream()` | TaskExecutorMachine (WS) | Stream de status das tarefas. |
| `ExecuteEnvironment({ environmentPath })` | EnvironmentRuntime | Executa um ambiente. |
| `ListRunningEnvironments()` | EnvironmentRuntime | Lista ambientes em execução. |
| `StopExecution({ executionId })` | EnvironmentRuntime | Encerra uma execução. |
| `OpenExecutionStatusStream({ executionId })` | EnvironmentRuntime (WS) | Stream de status de uma execução. |

## Dependências

Reaproveita `@/mount-api.lib` (via `require` relativo, como `command-executor.lib`).
Não declara `bound-params`.

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
