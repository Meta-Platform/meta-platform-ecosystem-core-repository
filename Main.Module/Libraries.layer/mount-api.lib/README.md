# mount-api.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/mount-api.lib`
- **Localização:** `Main.Module/Libraries.layer/mount-api.lib`

## Propósito

Biblioteca para **montar e consumir APIs** de comunicação com as aplicações do
ecossistema. É injetada como `mountApiLib` na CLI `repository-explorer.cli`
(`explorer`).

## Exports (`src/`)

| Módulo / pasta | Responsabilidade |
|----------------|------------------|
| `MountAPIs.js` | Monta os clientes/definições de API. |
| `Communication/` | Utilitários de comunicação (transporte). |

## Dependências

Apenas `metadata/package.json` (namespace) — sem `bound-params`.

> Consulte a [Arquitetura](../../../../../docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
