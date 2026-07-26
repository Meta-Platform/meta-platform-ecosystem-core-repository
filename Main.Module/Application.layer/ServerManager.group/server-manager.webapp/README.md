# server-manager.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/server-manager.webapp`
- **Localização:** `Main.Module/Application.layer/ServerManager.group/server-manager.webapp` (EcosystemCoreRepo)

## Propósito

Composição (`.webapp`) do **Server Manager** — interface web do grupo
`ServerManager.group`, que sobe o `server-manager.webgui` (front-end) sobre um
`@@/server-service` para gerenciar servidores HTTP.

## Execução

Executado pelo Package Executor. O `.webapp` não tem código próprio: ele só
declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/server-manager.webgui/endpoint-group`.
