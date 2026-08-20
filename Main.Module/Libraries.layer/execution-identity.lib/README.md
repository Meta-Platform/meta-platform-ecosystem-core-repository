# execution-identity.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/execution-identity.lib`
- **Localização:** `Main.Module/Libraries.layer/execution-identity.lib` (EcosystemCoreRepo)

## Propósito

Responder **"o que exatamente está rodando aqui?"** sobre um processo do
ecossistema.

Um processo pode ter sido lançado de três lugares diferentes — o código
provisionado no `EcosystemData`, um binário empacotado ou um release baixado — e
olhar para o processo não diz qual. Sem essa resposta, um monitor informa que um
pacote está no ar sem informar **qual versão** está no ar.

Toda a coleta é *best-effort*: nenhuma informação aqui pode derrubar quem está
subindo.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `DescribeExecution.ts` | Descreve a execução corrente: origem, caminho do pacote, nome e versão. |

A origem é classificada como `pkg-binary`, `source` ou `release`.

## Dependências

Apenas `metadata/package.json` (namespace) — sem `bound-params`.

> Veja o [README do repositório](../../../README.md).
