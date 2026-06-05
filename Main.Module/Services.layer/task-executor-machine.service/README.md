# task-executor-machine.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/task-executor-machine.service`
- **Localização:** `Main.Module/Services.layer/task-executor-machine.service`

## Propósito

Serviço que encapsula uma **máquina de execução de tarefas**: recebe um plano de
execução (`execution-params`) e o executa instanciando cada unidade através dos
*object loaders* da plataforma.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path |
|-----------|------|
| `StandardTaskExecutorMachineService` | `Services/StandardTaskExecutorMachine.service` |

Dependências (`bound-params`) — as libs de runtime do `essential-repository`:
`@/application-instance.lib`, `@/install-nodejs-package-dependencies.lib`,
`@/nodejs-package.lib`, `@/service-instance.lib`, `@/endpoint-instance.lib`,
`@/command-application.lib`, `@/task-executor.lib`, `@/utilities.lib`.

> Veja os [Tipos de Object Loader](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/tipos-de-object-loader.md)
> e o [Execution Params Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/packages/execution-params-standard.md).
> [README do repositório](../../../README.md).
