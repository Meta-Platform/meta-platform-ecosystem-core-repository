# package-toolkit.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/package-toolkit.lib`
- **Localização:** `Main.Module/Libraries.layer/package-toolkit.lib`

## Propósito

Biblioteca de **scaffolding de pacotes**: cria a estrutura de novos pacotes
(bibliotecas, CLIs e pacotes de serviços) seguindo as convenções da plataforma.
É injetada como `packageToolkitLib` na CLI `package-toolkit.cli` (`mypkg`).

## Exports (`src/`)

| Módulo / pasta | Responsabilidade |
|----------------|------------------|
| `CreateLibPackage.js` | Cria um pacote de biblioteca (`.lib`). |
| `CreateCliPackage.js` | Cria um pacote de linha de comando (`.cli`). |
| `CreateServicesPackage.js` | Cria um pacote de serviços (`.service`). |
| `AddEmptyJSFunctionToPackageSrc.js` | Adiciona um módulo JS vazio ao `src/` do pacote. |
| `Helpers/`, `Utils/` | Funções auxiliares de geração. |

## Dependências

Apenas `metadata/package.json` (namespace) — sem `bound-params`.

> Veja também o [Guia: Criar um Pacote](../../../../../docs/GUIA-CRIAR-PACOTE.md)
> e o [README do repositório](../../../README.md).
