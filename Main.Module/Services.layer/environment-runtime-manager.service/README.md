# environment-runtime-manager.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/environment-runtime-manager.service`
- **Localização:** `Main.Module/Services.layer/environment-runtime-manager.service` (EcosystemCoreRepo)

## Propósito

Serviço responsável pelo **runtime de ambientes de execução**: gera os
`execution-params` de um ambiente e os entrega à *task executor machine* para
serem executados.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (`bound-params`) |
|-----------|------|-------------------------------|
| `EnvironmentRuntimeService` | `Services/EnvironmentRuntime.service` | `@@/standard-task-executor-machine-service`, `@/json-file-utilities.lib`, `@/execution-params-generator.lib` |

Parâmetros (`params`): `EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES`,
`ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA`.

> Consumido por `ecosystem-instance-manager.app` e pelas aplicações de painel.
> Veja a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
