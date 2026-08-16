# package-toolkit.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/package-toolkit.lib`
- **Localização:** `Main.Module/Libraries.layer/package-toolkit.lib` (EcosystemCoreRepo)

## Propósito

Biblioteca de **scaffolding de pacotes**: cria a estrutura de novos pacotes
(bibliotecas, CLIs e pacotes de serviços) seguindo as convenções da plataforma.
É injetada como `packageToolkitLib` na CLI `package-toolkit.cli` (`mypkg`).

## Exports (`src/`)

| Módulo / pasta | Responsabilidade |
|----------------|------------------|
| `CreateLibPackage.ts` | Cria um pacote de biblioteca (`.lib`). |
| `CreateCliPackage.ts` | Cria um pacote de linha de comando (`.cli`). |
| `CreateServicesPackage.ts` | Cria um pacote de serviços (`.service`). |
| `AddEmptyFunctionToPackageSrc.ts` | Adiciona um módulo vazio ao `src/` do pacote. |
| `Helpers/`, `Utils/` | Funções auxiliares de geração — inclusive o `CreateTypeScriptConfigFile.ts`, que escreve o `tsconfig.json` do pacote novo. |

> O scaffolding gera **TypeScript**: os módulos de comando, de serviço e a função
> vazia nascem em `.ts`, e o pacote já sai com o seu `tsconfig.json`.

## Dependências

Apenas `metadata/package.json` (namespace) — sem `bound-params`.

> Veja também o [Guia: Criar um Pacote](https://github.com/Meta-Platform/.github/blob/main/docs/GUIA-CRIAR-PACOTE.md)
> e o [README do repositório](../../../README.md).
