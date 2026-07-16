# endpoint-instance.lib

- **Tipo:** biblioteca / *task loader* (`.lib`) · **Namespace:** `@/endpoint-instance.lib`

*Object loader* do tipo **`endpoint-instance`**: instancia um endpoint HTTP
(controller ou interface web) associado a um serviço de servidor, durante a
execução de um plano.

## Exports (`src/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `EndpointInstance.taskLoader.js` | Carrega/instancia o `endpoint-instance`. |
| `StartControllerService.js` | Sobe um endpoint do tipo *controller*. |
| `StartWebGraphicUserInterfaceService.js` | Sobe a interface web (web GUI). |
| `WebInterfaceBuilder.js` | Constrói/empacota a interface web. |

> Parâmetros e exemplo no `execution-params`: ver
> [Tipos de Object Loader → `endpoint-instance`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/tipos-de-object-loader.md#endpoint-instance).
> Para criar o seu próprio loader, veja o
> [Guia: como criar e usar um Object Loader](../../Executor.layer/task-executor.lib/docs/guia-criar-object-loader.md).
> [README do repositório](../../../README.md)
