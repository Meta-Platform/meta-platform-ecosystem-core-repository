# repository-manager.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/repository-manager.service`
- **Localização:** `Main.Module/Services.layer/repository-manager.service`

## Propósito

Serviço que **gerencia os repositórios instalados** no ecossistema: lê o registro
de repositórios e a hierarquia de pacotes, servindo de fonte de informação para
as aplicações e painéis.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (`bound-params`) |
|-----------|------|-------------------------------|
| `RepositoryManagerService` | `Services/RepositoryManager.service` | `@/repository-utilities.lib`, `@/dependency-graph-builder.lib` |

Parâmetros (`params`): `installDataDirPath`, `REPOS_CONF_FILENAME_REPOS_DATA`,
`REPOS_CONF_EXT_MODULE_DIR`, `REPOS_CONF_EXT_LAYER_DIR`,
`REPOS_CONF_EXT_GROUP_DIR`, `REPOS_CONF_EXTLIST_PKG_TYPE`,
`PKG_CONF_DIRNAME_METADATA`.

> Não confundir com a CLI `repo` (`repository-manager.cli`, do `essential-repository`),
> que instala/atualiza repositórios. Este é o **serviço** consumido em runtime
> pelas aplicações. Veja o [README do repositório](../../../README.md).
