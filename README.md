# Meta Ecosystem Core Repository

Repositório que fornece o **núcleo de operação do ecossistema**: o gerenciador de
instâncias, os painéis de controle (web) e os serviços de runtime (servidor HTTP,
task executor, gerenciamento de repositórios, ambientes e supervisão).

> Para a organização geral, veja a
> [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md). Para os conceitos formais, o
> [Open Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/README.md).

Os executáveis publicados por este repositório estão em
[`metadata/applications.json`](./metadata/applications.json).

## Main.Module

### Application.layer

| Pacote | Tipo | Executável |
|--------|------|------------|
| [ecosystem-instance-manager.app](./Main.Module/Application.layer/ecosystem-instance-manager.app/README.md) | `.app` | `executor-manager` |
| [instance-executor.cli](./Main.Module/Application.layer/instance-executor.cli/README.md) | `.cli` | `executor` |
| [repository-explorer.cli](./Main.Module/Application.layer/repository-explorer.cli/README.md) | `.cli` | `explorer` |
| [package-toolkit.cli](./Main.Module/Application.layer/package-toolkit.cli/README.md) | `.cli` | `mypkg` |
| [package-runner.cli](./Main.Module/Application.layer/package-runner.cli/README.md) | `.cli` | `run` |

#### EcosystemControlPanel.group — aplicação `eco-panel`

- [ecosystem-control-panel.webapp](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webapp/README.md) (`.webapp`)
- [ecosystem-control-panel.webgui](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webgui/README.md) (`.webgui`)
- [ecosystem-control-panel.webservice](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webservice/README.md) (`.webservice`)
- [ecosystem-control-panel.service](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.service/README.md) (`.service`)

#### InstanceExecutorControlPanel.group — aplicação `executor-panel`

- [instance-executor-control-panel.webapp](./Main.Module/Application.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webapp/README.md) (`.webapp`)
- [instance-executor-control-panel.webgui](./Main.Module/Application.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webgui/README.md) (`.webgui`)
- [instance-executor-control-panel.webservice](./Main.Module/Application.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webservice/README.md) (`.webservice`)

#### ServerManager.group

- [server-manager.webapp](./Main.Module/Application.layer/ServerManager.group/server-manager.webapp/README.md) (`.webapp`)
- [server-manager.webgui](./Main.Module/Application.layer/ServerManager.group/server-manager.webgui/README.md) (`.webgui`)

### Libraries.layer

- [command-executor.lib](./Main.Module/Libraries.layer/command-executor.lib/README.md)
- [mount-api.lib](./Main.Module/Libraries.layer/mount-api.lib/README.md)
- [package-toolkit.lib](./Main.Module/Libraries.layer/package-toolkit.lib/README.md)

### Services.layer

- [ecosystem-manager.service](./Main.Module/Services.layer/ecosystem-manager.service/README.md)
- [environment-runtime-manager.service](./Main.Module/Services.layer/environment-runtime-manager.service/README.md)
- [instance-supervisor.service](./Main.Module/Services.layer/instance-supervisor.service/README.md)
- [repository-manager.service](./Main.Module/Services.layer/repository-manager.service/README.md)
- [server-manager.service](./Main.Module/Services.layer/server-manager.service/README.md)
- [task-executor-machine.service](./Main.Module/Services.layer/task-executor-machine.service/README.md)

### Webservices.layer

- [server-manager.webservice](./Main.Module/Webservices.layer/server-manager.webservice/README.md)
