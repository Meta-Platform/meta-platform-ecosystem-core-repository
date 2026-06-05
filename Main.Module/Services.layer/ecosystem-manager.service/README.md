# ecosystem-manager.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/ecosystem-manager.service`
- **Localização:** `Main.Module/Services.layer/ecosystem-manager.service`

## Propósito

Serviço que **orquestra o ecossistema**: a partir dos repositórios instalados e
da hierarquia de metadados, prepara e dispara a execução de ambientes,
coordenando o gerenciador de repositórios e o runtime de ambientes.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (`bound-params`) |
|-----------|------|-------------------------------|
| `EcosystemManager` | `Managers/Ecosystem.manager` | `@/repository-config-handler.lib`, `@/environment-handler.lib`, `@/dependency-graph-builder.lib`, `@@/repository-manager`, `@@/environment-runtime-service`, `@/metadata-hierarchy-handler.lib`, `@/resolve-package-name.lib`, `@/json-file-utilities.lib` |

Parâmetros (`params`): `PKG_CONF_DIRNAME_METADATA`, `ECO_DIRPATH_INSTALL_DATA`,
`REPOS_CONF_FILENAME_REPOS_DATA`, `REPOS_CONF_EXT_GROUP_DIR`,
`EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES`,
`ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA`.

> Consumido pela aplicação `ecosystem-instance-manager.app` (`executor-manager`).
> Veja a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
