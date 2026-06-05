# package-runner.cli

- **Tipo:** aplicação de linha de comando (`.cli`)
- **Namespace:** `@/package-runner.cli`
- **Executável:** `run`
- **Localização:** `Main.Module/Application.layer/package-runner.cli`

## Propósito

CLI que **executa um pacote** de forma autossuficiente, montando localmente toda
a cadeia de runtime (geração de `execution-params` + *task executor* + object
loaders) sem depender da aplicação gerenciadora de instâncias.

## Comandos (`metadata/command-group.json`)

| Comando | Descrição |
|---------|-----------|
| `run package [packagePath]` | Executa um pacote. |

## Dependências (`metadata/boot.json` → `bound-params`)

Reúne as libs de runtime e de metadados necessárias para executar um pacote:
`@/repository-config-handler.lib`, `@/environment-handler.lib`,
`@/dependency-graph-builder.lib`, `@/metadata-hierarchy-handler.lib`,
`@/resolve-package-name.lib`, `@/repository-utilities.lib`,
`@/json-file-utilities.lib`, `@/execution-params-generator.lib`,
`@/application-instance.lib`, `@/install-nodejs-package-dependencies.lib`,
`@/nodejs-package.lib`, `@/service-instance.lib`, `@/endpoint-instance.lib`,
`@/command-application.lib`, `@/task-executor.lib`.

> Para execução isolada de baixo nível fora do ecossistema, veja também o
> [Package Executor](../../../../../Meta-Platform/meta-platform-package-executor-command-line/README.md).
> [README do repositório](../../../README.md).
