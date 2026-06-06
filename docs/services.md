# Serviços — Ecosystem Core

Os serviços de back-end do ecossistema (`Main.Module/Services.layer`) e como
**colaboram**. Cada serviço é declarado em `metadata/services.json` do seu package
e instanciado como `service-instance` pelo
[Task Executor](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/environment-runtime-standard.md).

| Serviço (package) | Namespace exposto | Depende de (`bound-params`) |
|-------------------|-------------------|------------------------------|
| [server-manager.service](../Main.Module/Services.layer/server-manager.service/README.md) | `HTTPServerService`, `JWTVerifierMiddlewareService` | `?middlewareService` (opcional) |
| [repository-manager.service](../Main.Module/Services.layer/repository-manager.service/README.md) | `RepositoryManagerService` | `repositoryUtilitiesLib`, `dependencyGraphBuilderLib` |
| [task-executor-machine.service](../Main.Module/Services.layer/task-executor-machine.service/README.md) | `StandardTaskExecutorMachineService` | task loaders + `task-executor.lib` + `utilities.lib` (do essential) |
| [environment-runtime-manager.service](../Main.Module/Services.layer/environment-runtime-manager.service/README.md) | `EnvironmentRuntimeService` | `taskExecutorMachineService`, `jsonFileUtilitiesLib`, `executionParamsGeneratorLib` |
| [ecosystem-manager.service](../Main.Module/Services.layer/ecosystem-manager.service/README.md) | `EcosystemManager` | `repositoryManagerService`, `environmentRuntimeService`, `repositoryConfigHandlerLib`, `environmentHandlerLib`, `dependencyGraphBuilderLib`, `metadataHierarchyHandlerLib`, `resolvePackageNameLib`, `jsonFileUtilitiesLib` |
| [instance-supervisor.service](../Main.Module/Services.layer/instance-supervisor.service/README.md) | `InstanceMonitoringManager` | `ecosystemdataHandlerService`, `supervisorLib`, `jsonFileUtilitiesLib`, `notificationHubService` |

> O grupo do painel acrescenta [ecosystem-control-panel.service](../Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.service/README.md)
> (`EnvironmentHandlerService`, `EcosystemDataHandlerService`, `NotificationHubService`).

## Quem chama quem

Confirmado pelo `boot.json` do
[ecosystem-instance-manager.app](../Main.Module/Application.layer/ecosystem-instance-manager.app/README.md),
que instancia e liga os serviços:

```
ecosystem-instance-manager.app
├── @@/server-service                       ← server-manager.service/HTTPServerService
├── @@/repository-manager                   ← repository-manager.service/RepositoryManagerService
├── @@/standard-task-executor-machine-service ← task-executor-machine.service/StandardTaskExecutorMachineService
├── @@/environment-runtime-service          ← environment-runtime-manager.service/EnvironmentRuntimeService
│        depende de → @@/standard-task-executor-machine-service
└── @@/ecosystem-manager                    ← ecosystem-manager.service/EcosystemManager
         depende de → @@/repository-manager, @@/environment-runtime-service
```

Resumo da colaboração:

- **server-manager** fornece o servidor HTTP base que toda interface web usa.
- **repository-manager** sabe quais repositórios/pacotes existem.
- **task-executor-machine** executa um plano (usa as libs de runtime do essential).
- **environment-runtime** prepara o ambiente e gera o execution params, entregando
  ao task-executor-machine.
- **ecosystem-manager** orquestra: usa repository-manager + environment-runtime
  para preparar e disparar a execução.
- **instance-supervisor** monitora as instâncias em execução (consumido pelos
  painéis).

Ver: [instance-lifecycle.md](./instance-lifecycle.md) ·
[runtime-environment-management.md](./runtime-environment-management.md) ·
[supervision.md](./supervision.md).
