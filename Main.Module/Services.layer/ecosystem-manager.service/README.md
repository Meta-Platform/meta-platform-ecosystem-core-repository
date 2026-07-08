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
`ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA`, `socket`.

> `socket` é o endereço do Unix socket do próprio daemon. Ele é injetado no
> ambiente do app desktop lançado (`META_LAUNCH_PROGRESS_SOCKET`) para que o app
> reporte o progresso de lançamento de volta. **Precisa estar tanto no
> `boot.json` quanto no `params` do `services.json`** (ver a whitelist em
> [docs/services.md](../../../docs/services.md)).

## Progresso de lançamento (ingest + stream)

Além da orquestração, o serviço expõe o feedback de abertura de apps ao MyDesktop:

- `ReportLaunchProgress({ launchId, phase, percentage })` — ingest chamado pelo
  app lançado (via HTTP no socket do daemon).
- `GetLaunchProgressSnapshot()` / `GetLaunchProgressEmitter()` — snapshot e
  emissor próprio (separado do stream de tasks) consumidos pelo controller
  `EcosystemManager` como `LaunchProgress` (POST) e `LaunchProgressStream` (WS).

Fluxo completo em
[MyDesktop — feedback de lançamento](https://github.com/Meta-Platform/meta-platform-applications-repository/blob/main/docs/mydesktop-launch-feedback.md).

> Consumido pela aplicação `ecosystem-instance-manager.app` (`executor-manager`).
> Veja a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
