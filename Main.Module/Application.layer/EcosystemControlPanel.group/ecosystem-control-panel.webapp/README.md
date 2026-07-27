# ecosystem-control-panel.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/ecosystem-control-panel.webapp`
- **Executável:** `eco-panel`
- **Localização:** `Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webapp` (EcosystemCoreRepo)

## Propósito

Composição (`.webapp`) do **Ecosystem Control Panel** — executável `eco-panel`.
Sobe o backend (`ecosystem-control-panel.webservice` + serviços do grupo) e o
front-end (`ecosystem-control-panel.webgui`) sobre um `@@/server-service`. Roda na
porta `9998` por padrão (ver [`metadata/startup-params.json`](./metadata/startup-params.json)).

O estado do painel (`panelStateFilePath`) é um **recurso declarado** em
[`metadata/storage-params.json`](./metadata/storage-params.json), compartilhado
com o `.desktopapp` pelo namespace `ecosystem-control-panel` — o caminho quem
resolve é a
[resource-params-handler.lib](../../../../../essential-repository/Runtime.Module/MetadataHelpers.layer/resource-params-handler.lib/README.md).

## Execução

Executado pelo Package Executor a partir do executável `eco-panel`, que o
ecossistema publica no `PATH`. O `.webapp` não tem código próprio: ele só
declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/notification-hub-service` a partir de `@/ecosystem-control-panel.service/services/NotificationHubService`.
- Serviço `@@/ecosystemdata-handler-service` a partir de `@/ecosystem-control-panel.service/services/EcosystemDataHandlerService`.
- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Serviço `@@/instance-monitoring-manager-service` a partir de `@/instance-supervisor.service/services/InstanceMonitoringManager`.
- Serviço `@@/environment-handler-service` a partir de `@/ecosystem-control-panel.service/services/EnvironmentHandlerService`.
- Serviço `@@/repository-manager` a partir de `@/repository-manager.service/services/RepositoryManagerService`.
- Endpoint group `@/ecosystem-control-panel.webgui/endpoint-group`.
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/ecosystem-control-panel.webservice/endpoint-group`.
