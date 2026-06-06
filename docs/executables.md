# Executáveis — Ecosystem Core

Os executáveis publicados por este repositório estão em
[`metadata/applications.json`](../metadata/applications.json). Cada um liga
**`executable`** (comando instalado em `EcosystemData/executables/`) →
**`packageNamespace`** (o package executado) → **`supervisorSocketFileName`** (o
[supervisor socket](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/supervisor-socket-standard.md)).

| `executable` | `appType` | `packageNamespace` | `supervisorSocketFileName` | Papel |
|--------------|-----------|--------------------|----------------------------|-------|
| `executor-manager` | APP | `Main.Module/Application.layer/ecosystem-instance-manager.app` | `instance-manager.sock` | Gerenciador de instâncias do ecossistema (sobe os serviços-núcleo). |
| `executor` | CLI | `Main.Module/Application.layer/instance-executor.cli` | `executor.sock` | Executa e acompanha pacotes/ambientes/tarefas. |
| `explorer` | CLI | `Main.Module/Application.layer/repository-explorer.cli` | `explorer.sock` | Explora repositórios/pacotes instalados. |
| `eco-panel` | APP | `…/EcosystemControlPanel.group/ecosystem-control-panel.webapp` | `eco-panel.sock` | Painel de controle do ecossistema (web). |
| `executor-panel` | APP | `…/InstanceExecutorControlPanel.group/instance-executor-control-panel.webapp` | `executor-panel.sock` | Painel do executor de instâncias (web). |
| `mypkg` | CLI | `Main.Module/Application.layer/package-toolkit.cli` | `package-toolkit.sock` | Cria novos pacotes (scaffolding). |
| `run` | CLI | `Main.Module/Application.layer/package-runner.cli` | `package-runner.sock` | Executa um package montando o runtime localmente. |

## Como `applications.json` publica executáveis

Ao instalar o repositório, o
[Setup Wizard](https://github.com/Meta-Platform/meta-platform-setup-wizard-command-line)
(ou a CLI `repo`) lê `applications.json` e cria, para cada entrada listada em
`executablesToInstall` do perfil, um script em `EcosystemData/executables/` com o
nome de `executable`. Ao rodar esse comando, o
[Package Executor](https://github.com/Meta-Platform/meta-platform-package-executor-command-line)
executa o `packageNamespace` correspondente. Ver
[Repository Metadata Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/repository-metadata-standard.md).

## Como se relacionam

- `executor-manager` sobe o **núcleo de serviços** (ver [services.md](./services.md))
  e é a peça central da operação.
- `executor` e `explorer` são **clientes/CLIs** que conversam com a aplicação
  principal (socket/endpoint) para operar e inspecionar.
- `run` é uma alternativa **autossuficiente** ao `executor` para rodar um único
  package sem depender do gerenciador de instâncias.
- `mypkg` é de **desenvolvimento** (cria pacotes novos).
- `eco-panel` e `executor-panel` são as **interfaces web** equivalentes aos
  painéis de operação.

Ver também: [architecture.md](./architecture.md) ·
[instance-lifecycle.md](./instance-lifecycle.md).
