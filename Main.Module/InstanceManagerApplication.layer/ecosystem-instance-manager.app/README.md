# ecosystem-instance-manager.app

- **Tipo:** aplicação (`.app`)
- **Namespace:** `@/ecosystem-instance-manager.app`
- **Executável:** `executor-manager`
- **Localização:** `Main.Module/InstanceManagerApplication.layer/ecosystem-instance-manager.app` (EcosystemCoreRepo)

## Propósito

Aplicação principal e a primeira a iniciar pela plataforma — executável
`executor-manager`.

O Ecosystem Instance Manager utiliza os mesmos pacotes de runtime que o
`meta-platform-package-executor-command-line` usa para executar, mas atua como o
**daemon** que fornece uma API REST para controle de execução (endpoints
`/task-executor-machine`, `/repository-manager`, `/ecosystem-manager`,
`/enviroment-runtime` e `/command-line-runtime` — ver
[`metadata/endpoint-group.json`](./metadata/endpoint-group.json)).

Como é ele quem lança as coisas, é também ele quem sabe o que está no ar: as
instâncias lançadas são persistidas via `instanceStoreFilePath`.

## Execução

Executado pelo Package Executor a partir do executável `executor-manager`,
escutando no socket informado em `socket`.

## Serviços disponibilizados

Um controller por área, definidos em `metadata/endpoint-group.json`:

| URL | Controller |
|---|---|
| `/task-executor-machine` | `Controllers/TaskExecutorMachine.controller` |
| `/repository-manager` | `Controllers/RepositoryManager.controller` |
| `/ecosystem-manager` | `Controllers/EcosystemManager.controller` |
| `/enviroment-runtime` | `Controllers/EnvironmentRuntime.controller` |
| `/command-line-runtime` | `Controllers/CommandLineRuntime.controller` |

### Observabilidade (controller `EcosystemManager`)

Como o daemon é quem executa, é dele que sai o que o
[Instance Executor](https://github.com/Meta-Platform/meta-platform-applications-repository/tree/main/Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group)
mostra de log e desempenho:

| Endpoint | Método | O quê |
|---|---|---|
| `/read-instance-log` | POST | Log de uma instância (tail ou incremento por offset) |
| `/instance-log-stream/:instanceId` | WS | Log ao vivo |
| `/list-instance-logs` | GET | Inventário dos logs em disco |
| `/list-instance-metrics` | GET | Snapshot de desempenho de todas as instâncias |
| `/instance-metrics` | POST | Série histórica de uma instância |
| `/metrics-stream` | WS | Uma amostra por tick |

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (no socket `{{socket}}`).
- Serviço `@@/repository-manager` a partir de `@/repository-manager.service/services/RepositoryManagerService`.
- Serviço `@@/standard-task-executor-machine-service` a partir de `@/task-executor-machine.service/services/StandardTaskExecutorMachineService`.
- Serviço `@@/environment-runtime-service` a partir de `@/environment-runtime-manager.service/services/EnvironmentRuntimeService`.
- Serviço `@@/ecosystem-manager` a partir de `@/ecosystem-manager.service/services/EcosystemManager`.
- Serviço `@@/command-line-runtime-service` a partir de `@/command-line-runtime-manager.service/services/CommandLineRuntimeService`.
- Endpoint group `@/server-manager.webservice/endpoint-group` e o seu próprio.

> Veja o [README do repositório](../../../README.md).
