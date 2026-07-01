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
`@/desktop-window-instance.lib`, `@/command-application.lib`,
`@/task-executor.lib`, `@/utilities.lib`.

## Registro dos object loaders

Este serviço é **o ponto onde os object loaders são registrados**: cada lib de
loader recebida em `bound-params` é mapeada para um `objectLoaderType` num
dicionário `taskLoaders` passado ao `TaskExecutor` (ver
[`StandardTaskExecutorMachine.service.js`](./src/Services/StandardTaskExecutorMachine.service.js)):

```javascript
const taskLoaders = {
    'install-nodejs-package-dependencies' : installNodejsPackageDependenciesLib.require("InstallNodejsPackageDependencies.taskLoader"),
    'nodejs-package'                      : nodejsPackageLib.require("NodeJSPackage.taskLoader"),
    'command-application'                 : commandApplicationLib.require("CommandApplication.taskLoader"),
    'application-instance'                : applicationInstanceLib.require("ApplicationInstance.taskLoader"),
    'service-instance'                    : serviceInstanceLib.require("ServiceInstance.taskLoader"),
    'endpoint-instance'                   : endpointInstanceLib.require("EndpointInstance.taskLoader"),
    'desktop-window-instance'             : desktopWindowInstanceLib.require("DesktopWindowInstance.taskLoader")
}
```

Para **adicionar um novo loader** à plataforma, inclua a lib nas `bound-params` e
adicione a entrada correspondente neste mapa. O passo a passo de implementação
está no
[Guia: como criar e usar um Object Loader](https://github.com/Meta-Platform/meta-platform-essential-repository/blob/main/Runtime.Module/Executor.layer/task-executor.lib/docs/guia-criar-object-loader.md).

> Veja os [Tipos de Object Loader](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/tipos-de-object-loader.md)
> e o [Execution Params Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/packages/execution-params-standard.md).
> [README do repositório](../../../README.md).
