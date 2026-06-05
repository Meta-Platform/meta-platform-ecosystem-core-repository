# command-executor.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/command-executor.lib`
- **Localização:** `Main.Module/Libraries.layer/command-executor.lib`

## Propósito

Biblioteca de apoio às CLIs do ecossistema que precisam **executar comandos** e
se comunicar com as aplicações em execução. É injetada como `commandExecutorLib`
nas CLIs `instance-executor.cli` (`executor`) e `repository-explorer.cli`
(`explorer`).

## Exports (`src/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `CommandExecutor.js` | Executa comandos da CLI. |
| `SmartRequire.js` | `require` resiliente a partir do diretório de dependências externas. |

## Dependências

Esta lib só declara o seu `metadata/package.json` (namespace) — não possui
`bound-params`.

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
