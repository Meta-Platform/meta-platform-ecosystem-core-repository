# Arquitetura — Ecosystem Core

Este documento descreve o papel do **Ecosystem Core** dentro da Meta Platform e
como suas peças se conectam. Para os conceitos gerais, veja o
[Open Standard](https://github.com/Meta-Platform/meta-platform-open-standard) e o
[Glossário](https://github.com/Meta-Platform/.github/blob/main/docs/glossario.md).

## Papel do Ecosystem Core

Enquanto o
[essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository)
fornece o **runtime e as bibliotecas essenciais** (task executor, task loaders,
libs comuns), o **Ecosystem Core** é o **núcleo operacional** do ecossistema: ele
sobe e gerencia **instâncias**, expõe **serviços** de back-end (servidor HTTP,
gerenciamento de repositórios, ambientes, supervisão de instâncias) e oferece os
**painéis web** e **CLIs** de operação do dia a dia.

## Executáveis publicados (`metadata/applications.json`)

Cada entrada de [`applications.json`](../metadata/applications.json) liga três
coisas (ver
[Repository Metadata Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/repository-metadata-standard.md)):

- **`executable`** — o comando instalado em `EcosystemData/executables/`;
- **`packageNamespace`** — o package que será executado (`Module/Layer/[Group/]Package`);
- **`supervisorSocketFileName`** — o socket de supervisão criado quando ele roda.

| `executable` | `packageNamespace` | `supervisorSocketFileName` | `appType` |
|--------------|--------------------|----------------------------|-----------|
| `executor-manager` | `Main.Module/InstanceManagerApplication.layer/ecosystem-instance-manager.app` | `instance-manager.sock` | APP |
| `explorer` | `Main.Module/Application.layer/repository-explorer.cli` | `explorer.sock` | CLI |
| `executor` | `Main.Module/InstanceManagerApplication.layer/instance-executor.cli` | `executor.sock` | CLI |
| `eco-panel` | `Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webapp` | `eco-panel.sock` | APP |
| `eco-panel-desktop` | `Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.desktopapp` | `eco-panel-desktop.sock` | DESKTOP |
| `mypkg` | `Main.Module/PackageApplication.layer/package-toolkit.cli` | `package-toolkit.sock` | CLI |
| `run` | `Main.Module/PackageApplication.layer/package-runner.cli` | `package-runner.sock` | CLI |

> A tripla `executable ↔ packageNamespace ↔ supervisorSocketFileName` é o que o
> ecossistema usa para, ao digitar `executor-manager`, saber **qual package**
> executar e **em qual socket** supervisioná-lo.

## Fluxo de execução

```
executável (ex.: executor-manager)
   → Package Executor cria um Runtime Environment para ecosystem-instance-manager.app
   → metadata-hierarchy.json → execution-params.json
   → Task Executor instancia serviços e endpoints (object loaders)
   → instância no ar, supervisionada via instance-manager.sock
```

Fluxo geral da plataforma:
[execution-flow](https://github.com/Meta-Platform/.github/blob/main/docs/execution-flow.md).

## Serviços principais (`Main.Module/Services.layer`)

| Serviço | Papel |
|---------|-------|
| [server-manager.service](../Main.Module/Services.layer/server-manager.service/README.md) | Servidor HTTP base (`@@/server-service`) usado por quase toda app web. |
| [repository-manager.service](../Main.Module/Services.layer/repository-manager.service/README.md) | Gerencia os repositórios instalados em runtime. |
| [ecosystem-manager.service](../Main.Module/Services.layer/ecosystem-manager.service/README.md) | Orquestra o ecossistema (prepara e dispara execução de ambientes). |
| [environment-runtime-manager.service](../Main.Module/Services.layer/environment-runtime-manager.service/README.md) | Runtime de ambientes (gera execution params e entrega ao task executor machine). |
| [task-executor-machine.service](../Main.Module/Services.layer/task-executor-machine.service/README.md) | Máquina de execução de tarefas (usa as libs de runtime do essential). |
| [instance-supervisor.service](../Main.Module/Services.layer/instance-supervisor.service/README.md) | Monitora instâncias em execução e publica notificações. |

## CLIs principais

| CLI | Executável | Papel |
|-----|-----------|-------|
| [instance-executor.cli](../Main.Module/InstanceManagerApplication.layer/instance-executor.cli/README.md) | `executor` | Executa e acompanha pacotes/ambientes/tarefas. |
| [repository-explorer.cli](../Main.Module/Application.layer/repository-explorer.cli/README.md) | `explorer` | Explora repositórios/pacotes instalados. |
| [package-toolkit.cli](../Main.Module/PackageApplication.layer/package-toolkit.cli/README.md) | `mypkg` | Cria novos pacotes (scaffolding). |
| [package-runner.cli](../Main.Module/PackageApplication.layer/package-runner.cli/README.md) | `run` | Executa um package montando o runtime localmente. |

## Painéis web

| Grupo | Executável | Papel |
|-------|-----------|-------|
| [EcosystemControlPanel.group](../Main.Module/Application.layer/EcosystemControlPanel.group/) | `eco-panel` (web), `eco-panel-desktop` (Electron) | Painel de controle do ecossistema. |
| [ServerManager.group](../Main.Module/Application.layer/ServerManager.group/) | — | Gerenciador de servidores (web). |

## Relação com Package Executor e Supervisor Socket

- O **Package Executor**
  ([repo](https://github.com/Meta-Platform/meta-platform-package-executor-command-line))
  é quem efetivamente cria o Runtime Environment e roda cada package do Ecosystem
  Core; o `task-executor-machine.service` encapsula essa execução dentro do
  ecossistema.
- Cada instância expõe um **Supervisor Socket** (gRPC sobre Unix socket) cujo
  nome vem de `applications.json`; a CLI `supervisor` (do essential) e o
  `instance-supervisor.service` consomem essa interface. Ver
  [Supervisor Socket Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/supervisor-socket-standard.md).
