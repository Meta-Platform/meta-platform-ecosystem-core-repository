# workspace-store.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/workspace-store.lib`
- **Localização:** `Main.Module/Libraries.layer/workspace-store.lib` (EcosystemCoreRepo)

## Propósito

Biblioteca compartilhada de **persistência de Workspaces** (SQLite via Sequelize),
seguindo o padrão de banco do virtual-desk (`~/virtual-desk-state/local-databases/*.sqlite`).

Uma **Workspace** é, neste MVP, um ponteiro `{ name, path }` para um diretório do
filesystem que é varrido em busca de pacotes.

Reutilizada por:
- `package-developer.webservice` (via `PackageHandlerManager` do `package-developer.lib`)
- `package-toolkit.cli` (comandos `mypkg workspace ...`)

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `InitializeWorkspaceStore.ts` | Cria o store de workspaces (SQLite via Sequelize) e expõe seu CRUD. |

## API

```ts
const InitializeWorkspaceStore = workspaceStoreLib.require("InitializeWorkspaceStore")
const store = InitializeWorkspaceStore("~/virtual-desk-state/local-databases/package-developer-workspace-store-service.sqlite")

await store.ConnectAndSync()            // authenticate + sync
await store.List()                      // [{ name, path }]
await store.Get({ name })               // { name, path } | undefined
await store.Create({ name, path })      // upsert -> { name, path }
await store.Remove({ name })            // nº de linhas removidas
```
