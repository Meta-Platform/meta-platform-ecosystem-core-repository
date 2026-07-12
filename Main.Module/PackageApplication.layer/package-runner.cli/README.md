# package-runner.cli

- **Tipo:** aplicação de linha de comando (`.cli`)
- **Namespace:** `@/package-runner.cli`
- **Executável:** `run`
- **Localização:** `Main.Module/PackageApplication.layer/package-runner.cli`

## Propósito

CLI que **executa um pacote** de forma autossuficiente, montando localmente toda
a cadeia de runtime (geração de `execution-params` + *task executor* + object
loaders) sem depender da aplicação gerenciadora de instâncias.

Ele é uma camada acima do package-executor (pkg)

## Comandos (`metadata/command-group.json`)

| Comando | Descrição |
|---------|-----------|
| `run package [packagePath]` | Executa um pacote. |

## Dependências (`metadata/boot.json` → `bound-params`)

Reúne as libs de runtime e de metadados necessárias para executar um pacote:
`@/repository-config-handler.lib`, `@/environment-handler.lib`,
`@/dependency-graph-builder.lib`, `@/metadata-hierarchy-handler.lib`,
`@/resolve-package-name.lib`, `@/repository-utilities.lib`,
`@/json-file-utilities.lib`, `@/ecosystem-defaults-handler.lib`,
`@/execution-params-generator.lib`, `@/application-instance.lib`,
`@/install-nodejs-package-dependencies.lib`, `@/nodejs-package.lib`,
`@/service-instance.lib`, `@/endpoint-instance.lib`,
`@/desktop-window-instance.lib`, `@/command-application.lib`,
`@/task-executor.lib`.

> ⚠️ **Toda lib injetada num `.cli` precisa ser declarada em DOIS lugares.** O
> `boot.json` fornece o *valor* (`"xLib": "@/x.lib"`), mas o *nome* do parâmetro
> também tem que estar no `command-group.json`, tanto no array `bound-params`
> quanto no `parametersToLoad` do comando. O resolvedor de nomes só itera sobre
> o que está declarado no `command-group.json`; se o nome não estiver lá, a
> referência resolve para `null` — mesmo com a lib provisionada e registrada — e
> a montagem de parâmetros da task quebra com
> `TypeError: Cannot convert undefined or null to object`
> (`AssembleLinkedTaskParameters.js`), matando o processo logo no lançamento.
> Como o daemon lança toda aplicação via `run package`, essa falha derruba o
> launch de **todos** os apps (ex.: ícones do MyDesktop que "carregam e fecham").
> Ao adicionar/remover uma lib aqui, altere `boot.json` **e**
> `command-group.json` juntos.

> Para execução isolada de baixo nível fora do ecossistema, veja também o
> [Package Executor](https://github.com/Meta-Platform/meta-platform-package-executor-command-line/blob/main/README.md).
> [README do repositório](../../../README.md).
