# Gerenciamento de Runtime Environments — Ecosystem Core

Como o ecossistema **prepara e executa** os ambientes de execução
([Runtime Environment](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/runtime-environment.md)).

## Peças

- **environment-runtime-manager.service** (`EnvironmentRuntimeService`) — prepara
  o ambiente e **gera o execution params** a partir da metadata hierarchy,
  entregando-o à máquina de execução. Depende de `taskExecutorMachineService`,
  `jsonFileUtilitiesLib` e `executionParamsGeneratorLib`.
- **task-executor-machine.service** (`StandardTaskExecutorMachineService`) —
  encapsula uma **máquina de execução de tarefas**; recebe o plano e instancia
  cada unidade via os **task loaders** (object loaders) do
  [essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository).
  É também o ponto onde os loaders são **registrados** (mapa `objectLoaderType →
  loader`); ver o
  [README do serviço](../Main.Module/Services.layer/task-executor-machine.service/README.md)
  e o [Guia: como criar e usar um Object Loader](https://github.com/Meta-Platform/meta-platform-essential-repository/blob/main/Runtime.Module/Executor.layer/task-executor.lib/docs/guia-criar-object-loader.md).

## Artefatos no ambiente

Cada execução gera um diretório em `EcosystemData/environments/`
(`<nome-do-package>-<hash>`), contendo:

| Arquivo | Papel |
|---------|-------|
| `metadata-hierarchy.json` | Grafo de metadados (package raiz + dependências resolvidas por namespace). |
| `execution-params.json` | Plano de execução (unidades + ligações). |
| `.dependencies/node_modules` | Dependências Node.js do ambiente. |

Padrões: [Environment Runtime Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/environment-runtime-standard.md)
· [Execution Params Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/packages/execution-params-standard.md).

## Fluxo

```
ecosystem-manager.service
   → environment-runtime-manager.service (prepara ambiente, gera execution-params)
       → task-executor-machine.service (executa o plano)
           → object loaders: install-nodejs-package-dependencies, nodejs-package,
             application-instance, service-instance, endpoint-instance, command-application,
             desktop-window-instance
               → Package Instance
```

## Inspeção (CLI `executor`)

```bash
executor environments          # ambientes em execução
executor tasks                 # tarefas no task executor
executor show task <id>        # detalhe de uma task
```

Ver: [instance-lifecycle.md](./instance-lifecycle.md) · [services.md](./services.md).
