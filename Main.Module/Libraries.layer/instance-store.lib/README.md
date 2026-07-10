# instance-store.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/instance-store.lib`
- **Localização:** `Main.Module/Libraries.layer/instance-store.lib` (EcosystemCoreRepository)

## Propósito

Persistência (SQLite via Sequelize) das **instâncias lançadas pelo daemon
`executor-manager`**, seguindo o padrão de banco do virtual-desk
(`~/virtual-desk-state/local-databases/*.sqlite`), como a
[`workspace-store.lib`](../workspace-store.lib).

O daemon centraliza a execução, logo é ele quem sabe o que colocou no ar. Antes,
esse conhecimento vivia só em memória (um `Map` de processos desktop) e se perdia
a cada restart do daemon — deixando aplicações **vivas e invisíveis** para os
painéis. Aqui ele é persistido e reconciliado.

Uma **Instance** é `{ instanceId, packagePath, kind, pid?, taskId?, executionId?, launchedBy?, status }`.

`instanceId` — e não `packagePath` — é a identidade. Um pacote `desktop` roda em
**várias instâncias simultâneas** (o usuário abre a mesma aplicação duas vezes), e
cada uma precisa ser distinguível para ser encerrada e contada individualmente. É
o `instanceId` que viaja como `META_LAUNCH_ID` até o Electron e volta nos eventos
de progresso.

### `kind` determina o ciclo de vida

| kind | onde roda | várias instâncias? | sobrevive ao restart do daemon? |
|---|---|---|---|
| `app` | in-process, no task-executor do daemon | não — uma por `packagePath` | não — morre junto |
| `desktop` | processo separado (Electron, via `run package`) | **sim** | sim |
| `cli` | processo separado (pty) | não — uma por `packagePath` | sim |

`RegisterLaunch` respeita isso: para `desktop` cria sempre uma linha nova; para os
demais, sobrescreve a instância `RUNNING` que já exista daquele `packagePath`.

### Migração do schema

O schema original tinha `packagePath NOT NULL UNIQUE` e nenhum `instanceId`. Como
o SQLite não remove uma constraint `UNIQUE` por `ALTER TABLE` — e `sync()` não
altera tabela existente —, `ConnectAndSync()` recria a tabela quando detecta o
formato antigo, preservando as linhas. O `launchId` legado *era* o `packagePath`,
então ele vira o `instanceId` das linhas migradas, e uma instância desktop viva
continua sendo readotada pelo `Reconcile()`.

## Reconciliação

`Reconcile()` roda no start do daemon e alinha o registro com a realidade:
processos próprios (`desktop`/`cli`) cujo `pid` ainda vive são **readotados**;
os mortos, e **todo** `app` in-process (que morreu com o daemon), viram `STOPPED`.

## API

```js
const InitializeInstanceStore = instanceStoreLib.require("InitializeInstanceStore")
const store = InitializeInstanceStore("~/virtual-desk-state/local-databases/ecosystem-instance-store.sqlite")

await store.ConnectAndSync()                              // conecta, migra o schema e sincroniza
await store.Reconcile()                                   // { adopted, cleaned }

await store.RegisterLaunch({ instanceId, packagePath, kind, pid, launchedBy })
await store.AttachRuntimeIds({ instanceId, taskId, executionId })

await store.MarkStopped({ instanceId })                   // uma instância
await store.MarkStoppedByPackage({ packagePath })         // todas as do pacote

await store.ListRunning()                                 // [ Instance ]
await store.ListRunningByPackage({ packagePath })         // instâncias vivas de um pacote
await store.List()                                        // histórico completo
await store.Get({ instanceId })
```

> Veja o [README do repositório](../../../README.md).
