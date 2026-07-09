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

Uma **Instance** é `{ packagePath, kind, pid?, taskId?, executionId?, launchedBy?, status }`.
`packagePath` é a identidade: um mesmo pacote não roda duas vezes ao mesmo tempo.

### `kind` determina o ciclo de vida

| kind | onde roda | sobrevive ao restart do daemon? |
|---|---|---|
| `app` | in-process, no task-executor do daemon | não — morre junto |
| `desktop` | processo separado (Electron, via `run package`) | sim |
| `cli` | processo separado (pty) | sim |

## Reconciliação

`Reconcile()` roda no start do daemon e alinha o registro com a realidade:
processos próprios (`desktop`/`cli`) cujo `pid` ainda vive são **readotados**;
os mortos, e **todo** `app` in-process (que morreu com o daemon), viram `STOPPED`.

## API

```js
const InitializeInstanceStore = instanceStoreLib.require("InitializeInstanceStore")
const store = InitializeInstanceStore("~/virtual-desk-state/local-databases/ecosystem-instance-store.sqlite")

await store.ConnectAndSync()
await store.Reconcile()                                   // { adopted, cleaned }

await store.RegisterLaunch({ packagePath, kind, pid, launchedBy })
await store.AttachRuntimeIds({ packagePath, taskId, executionId })
await store.MarkStopped({ packagePath })

await store.ListRunning()                                 // [ Instance ]
await store.List()                                        // histórico completo
await store.Get({ packagePath })
```

> Veja o [README do repositório](../../../README.md).
