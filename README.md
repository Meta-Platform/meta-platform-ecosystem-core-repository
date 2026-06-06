# Meta Platform — Ecosystem Core Repository

> O **núcleo operacional** da Meta Platform: sobe e gerencia instâncias, expõe os
> serviços de runtime e os painéis/CLIs de operação do ecossistema.

## Papel dentro da Meta Platform

A Meta Platform é um ecossistema modular (ver
[portal](https://github.com/Meta-Platform) e
[mapa de repositórios](https://github.com/Meta-Platform/.github/blob/main/docs/repository-map.md)).
Neste conjunto, o **Ecosystem Core** é o **núcleo operacional**: depende do
runtime e das bibliotecas do
[essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository)
e usa o
[package-executor](https://github.com/Meta-Platform/meta-platform-package-executor-command-line)
para, em cima deles, oferecer o gerenciador de instâncias, os serviços
(servidor HTTP, repositórios, ambientes, supervisão) e os painéis web.

## Quando usar

Quando você quer **operar** o ecossistema: subir o gerenciador de instâncias,
abrir os painéis web, executar/inspecionar pacotes e ambientes, ou criar novos
pacotes (`mypkg`).

## Instalação

Instalado como repositório do ecossistema (namespace `EcosystemCoreRepo`) via
[Setup Wizard](https://github.com/Meta-Platform/meta-platform-setup-wizard-command-line):

```bash
mywizard install --profile release-standard   # inclui EssentialRepo + EcosystemCoreRepo
```

## Uso rápido

```bash
start-instance-manager                       # sobe o gerenciador de instâncias
supervisor status instance-manager.sock      # supervisão
executor tasks                               # tarefas no task executor
eco-panel                                    # painel de controle do ecossistema (web)
```

## Conceitos importantes

Documentação dedicada em [`docs/`](./docs/):

| Documento | Conteúdo |
|-----------|----------|
| [architecture.md](./docs/architecture.md) | Papel do Ecosystem Core, fluxo, serviços, CLIs, painéis. |
| [executables.md](./docs/executables.md) | Executáveis de `applications.json` e a tripla `executable ↔ packageNamespace ↔ supervisorSocketFileName`. |
| [services.md](./docs/services.md) | Serviços e **quem chama quem**. |
| [instance-lifecycle.md](./docs/instance-lifecycle.md) | Como um package vira uma instância. |
| [supervision.md](./docs/supervision.md) | Supervisor sockets e a CLI `supervisor`. |
| [repository-management.md](./docs/repository-management.md) | Repositórios em runtime. |
| [runtime-environment-management.md](./docs/runtime-environment-management.md) | Ambientes de execução e task executor. |

- Conceitos gerais: [Glossário](https://github.com/Meta-Platform/.github/blob/main/docs/glossario.md).

## Estrutura do repositório

### Main.Module / Application.layer

| Package | Tipo | Executável |
|---------|------|------------|
| [ecosystem-instance-manager.app](./Main.Module/Application.layer/ecosystem-instance-manager.app/README.md) | `.app` | `executor-manager` |
| [instance-executor.cli](./Main.Module/Application.layer/instance-executor.cli/README.md) | `.cli` | `executor` |
| [repository-explorer.cli](./Main.Module/Application.layer/repository-explorer.cli/README.md) | `.cli` | `explorer` |
| [package-toolkit.cli](./Main.Module/Application.layer/package-toolkit.cli/README.md) | `.cli` | `mypkg` |
| [package-runner.cli](./Main.Module/Application.layer/package-runner.cli/README.md) | `.cli` | `run` |

**EcosystemControlPanel.group** (`eco-panel`):
[webapp](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webapp/README.md) ·
[webgui](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webgui/README.md) ·
[webservice](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webservice/README.md) ·
[service](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.service/README.md)

**InstanceExecutorControlPanel.group** (`executor-panel`):
[webapp](./Main.Module/Application.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webapp/README.md) ·
[webgui](./Main.Module/Application.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webgui/README.md) ·
[webservice](./Main.Module/Application.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webservice/README.md)

**ServerManager.group**:
[webapp](./Main.Module/Application.layer/ServerManager.group/server-manager.webapp/README.md) ·
[webgui](./Main.Module/Application.layer/ServerManager.group/server-manager.webgui/README.md)

### Main.Module / Libraries.layer

- [command-executor.lib](./Main.Module/Libraries.layer/command-executor.lib/README.md)
- [mount-api.lib](./Main.Module/Libraries.layer/mount-api.lib/README.md)
- [package-toolkit.lib](./Main.Module/Libraries.layer/package-toolkit.lib/README.md)

### Main.Module / Services.layer

- [ecosystem-manager.service](./Main.Module/Services.layer/ecosystem-manager.service/README.md)
- [environment-runtime-manager.service](./Main.Module/Services.layer/environment-runtime-manager.service/README.md)
- [instance-supervisor.service](./Main.Module/Services.layer/instance-supervisor.service/README.md)
- [repository-manager.service](./Main.Module/Services.layer/repository-manager.service/README.md)
- [server-manager.service](./Main.Module/Services.layer/server-manager.service/README.md)
- [task-executor-machine.service](./Main.Module/Services.layer/task-executor-machine.service/README.md)

### Main.Module / Webservices.layer

- [server-manager.webservice](./Main.Module/Webservices.layer/server-manager.webservice/README.md)

## Exemplos

Ver os READMEs de cada package (comandos e exemplos por executável) e o
[fluxo de execução](https://github.com/Meta-Platform/.github/blob/main/docs/execution-flow.md).

## Troubleshooting

- **`start-instance-manager` não encontrado** → garanta `EcosystemData/executables`
  no `PATH`.
- **`supervisor status` falha** → o processo correspondente precisa estar rodando
  (cria o socket em `EcosystemData/supervisor-sockets/`). Ver
  [Supervisor Socket Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/supervisor-socket-standard.md).

## Links relacionados

- [Arquitetura do Ecosystem Core](./docs/architecture.md)
- [Open Standard](https://github.com/Meta-Platform/meta-platform-open-standard)
- [Mapa de Repositórios](https://github.com/Meta-Platform/.github/blob/main/docs/repository-map.md)
- [essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository) · [package-executor](https://github.com/Meta-Platform/meta-platform-package-executor-command-line)

## Licença

BSD-3-Clause. Veja `LICENSE`.
