# instance-executor.cli

- **Tipo:** aplicação de linha de comando (`.cli`)
- **Namespace:** `@/instance-executor.cli`
- **Executável:** `executor`
- **Localização:** `Main.Module/InstanceManagerApplication.layer/instance-executor.cli`

## Propósito

CLI para **executar e acompanhar** pacotes, ambientes e tarefas no *task executor*
do ecossistema. Comunica-se com a aplicação principal pelo socket
`platformApplicationSocketPath` / endpoint `httpServerManagerEndpoint`.

## Comandos (`metadata/command-group.json`)

| Comando | Descrição |
|---------|-----------|
| `executor package [path]` | Executa um pacote. |
| `executor env [path]` | Executa um ambiente a partir de um caminho. |
| `executor stop env [executionId]` | Para um ambiente em execução. |
| `executor tasks` | Lista tarefas carregadas no task executor global. |
| `executor environments` | Lista ambientes em execução. |
| `executor monitor` | Monitora a atividade do Task Executor. |
| `executor show task [taskId]` | Mostra informações sobre uma tarefa específica. |

## Dependências (`metadata/boot.json` → `bound-params`)

- `@/command-executor.lib` (`commandExecutorLib`)
- `@/task-table-render.lib` (`taskTableRenderLib`)

Parâmetros de boot: `platformApplicationSocketPath`, `httpServerManagerEndpoint`,
`REPOS_CONF_EXT_GROUP_DIR`.

> Veja o [Guia de Início Rápido](https://github.com/Meta-Platform/.github/blob/main/docs/GUIA-INICIO-RAPIDO.md#6-executar-pacotes-executor--pkg-exec)
> e o [README do repositório](../../../README.md).
