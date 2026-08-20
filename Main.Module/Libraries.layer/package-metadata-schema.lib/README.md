# package-metadata-schema.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/package-metadata-schema.lib`
- **Localização:** `Main.Module/Libraries.layer/package-metadata-schema.lib` (EcosystemCoreRepo)

## Propósito

O **contrato dos arquivos de `metadata/`** de um pacote, num lugar só: quais
arquivos existem, que campos cada um aceita, quais são obrigatórios por tipo de
pacote, e a validação correspondente.

Existe para que ferramentas que criam, editam ou conferem pacotes — o Package
Developer, o `mypkg`, os validadores — usem a **mesma** definição, em vez de cada
uma manter a sua e divergirem.

A norma dos metadados é o
[Package Metadata Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/package-metadata-standard.md);
esta lib é a sua representação executável.

## Exports (`src/`)

| Export | Responsabilidade |
|---|---|
| `SCHEMA_VERSION` | Versão do contrato. |
| `GetMetadataSchema` | O schema completo. |
| `GetFileSpec` / `ResolveFileSpecForPath` | A especificação de um arquivo de metadado. |
| `IsKnownMetadataFile` | Se um arquivo pertence ao contrato. |
| `GetRequiredFiles` | Os arquivos obrigatórios para um tipo de pacote. |
| `ValidateMetadataFile` | Valida um arquivo isolado. |
| `ValidateMetadataCrossFile` | Valida o que só se verifica entre arquivos. |
| `ValidateMetadataFiles` | Valida o conjunto. |

Consumo por `.require()`. **Não há `services.json`**: não há nada a instanciar —
é contrato e função pura, e um serviço só acrescentaria ciclo de vida a quem não
tem estado.

## Dependências

Apenas `metadata/package.json` (namespace) — sem `bound-params`.

> Veja o [README do repositório](../../../README.md).
