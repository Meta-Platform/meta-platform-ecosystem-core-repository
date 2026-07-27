# ecosystem-manager.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/ecosystem-manager.service`
- **Localização:** `Main.Module/Services.layer/ecosystem-manager.service` (EcosystemCoreRepo)

## Propósito

Serviço que **orquestra o ecossistema**: a partir dos repositórios instalados e
da hierarquia de metadados, prepara e dispara a execução de ambientes,
coordenando o gerenciador de repositórios e o runtime de ambientes.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (`bound-params`) |
|-----------|------|-------------------------------|
| `EcosystemManager` | `Managers/Ecosystem.manager` | `@/repository-config-handler.lib`, `@/environment-handler.lib`, `@/dependency-graph-builder.lib`, `@@/repository-manager`, `@@/environment-runtime-service`, `@@/standard-task-executor-machine-service`, `@/metadata-hierarchy-handler.lib`, `@/resolve-package-name.lib`, `@/json-file-utilities.lib`, `@/instance-store.lib`, `@/process-metrics.lib`, `@/ecosystem-defaults-handler.lib` |

Parâmetros (`params`): `PKG_CONF_DIRNAME_METADATA`, `ECO_DIRPATH_INSTALL_DATA`,
`REPOS_CONF_FILENAME_REPOS_DATA`, `REPOS_CONF_EXT_GROUP_DIR`,
`EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES`,
`ECOSYSTEMDATA_CONF_FILENAME_PKG_GRAPH_DATA`, `instanceStoreFilePath`,
`metricsSampleIntervalMs`, `metricsHistorySize`, `instanceLogMaxBytes`,
`instanceLogRetentionDays`, `socket`.

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

## Observabilidade das instâncias

O daemon centraliza a execução, então é ele — e só ele — que pode responder
**como** está indo o que colocou no ar. Duas capacidades, consumidas pelo
[Instance Executor](https://github.com/Meta-Platform/meta-platform-applications-repository/tree/main/Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group):

### Log por instância

Cada instância já tinha um log em `<install-data>/instance-logs/<instanceId>.log`
(stdout/stderr do processo, para `desktop`; transições de estado da execução,
para `app` in-process) — mas não havia como lê-lo sem abrir um terminal.

- `ReadInstanceLog({ instanceId, tailLines, fromOffset })` — sem `fromOffset`,
  as últimas linhas; com ele, só o que veio depois. Uma linha ainda sem `\n`
  (escrita em curso) fica para a leitura seguinte, e o `offset` recua para não
  perdê-la. `fromOffset` maior que o arquivo significa rotação: relê do início e
  devolve `rotated: true`.
- `InstanceLogStream(ws, instanceId)` — snapshot + incrementos ao vivo.
- `ListInstanceLogs()` — inventário cruzado com o registro de instâncias, para
  abrir o log de algo **já encerrado** (quando ele mais importa).

O arquivo é truncado ao passar de `instanceLogMaxBytes`, e o log de instância
encerrada é apagado depois de `instanceLogRetentionDays`.

### Desempenho

Amostragem a cada `metricsSampleIntervalMs` via [`@/process-metrics.lib`](../../Libraries.layer/process-metrics.lib),
com `metricsHistorySize` amostras em memória por instância.

- `ListInstanceMetrics()` — snapshot de todas + estado da máquina.
- `GetInstanceMetrics({ instanceId, limit })` — série histórica, para o gráfico.
- `MetricsStream(ws)` — uma amostra por tick.

| kind | como é medido |
|---|---|
| `desktop` / `cli` | o **grupo de processos** (pgid = pid, pois o spawn é `detached`): `run` + Electron + renderers |
| `app` | roda in-process: reporta o processo do daemon, marcado `shared: true` — não existe medição isolada, e a interface precisa dizer isso |

> Consumido pela aplicação `ecosystem-instance-manager.app` (`executor-manager`).
> Veja a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
