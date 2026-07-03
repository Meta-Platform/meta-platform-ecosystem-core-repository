# ecosystem-control-panel.webservice

Web service (backend) do **Ecosystem Control Panel** (executável `eco-panel` /
`eco-panel-desktop`). Expõe as APIs REST/controllers que o
`ecosystem-control-panel.webgui` consome para operar e inspecionar o ecossistema.

## Execução

Não é executado de forma independente (`node index.js`). É montado em runtime
sobre um `@@/server-service` a partir do seu
[`metadata/endpoint-group.json`](./metadata/endpoint-group.json), quando o package
do grupo (`ecosystem-control-panel.webapp`/`.desktopapp`) é executado pelo Package
Executor. Depende, via `bound-params`, de serviços como `serverService`,
`instanceMonitoringManager`, `environmentHandlerService`,
`ecosystemdataHandlerService`, `repositoryManagerService`,
`ecosystemInstallUtilitiesLib` e `notificationHubService`.

## Endpoints (controllers)

Cada grupo é um controller montado a partir de um `APIs/*.api.json`
(ver [`src/Controllers/`](./src/Controllers/)):

| URL | Controller | Papel |
|-----|-----------|-------|
| `/supervisor` | InstancesSupervisor | Monitoramento/supervisão das instâncias em execução. |
| `/applications-and-repositories` | ApplicationsAndPackages | Aplicações e repositórios instalados. |
| `/executables` | Executables | Executáveis registrados no ecossistema. |
| `/environments` | Environments | Ambientes de execução. |
| `/sources` | Sources | Fontes de repositório. |
| `/configurations` | Configurations | Configurações do ecossistema. |
| `/host-actions` | HostActions | Ações no host. |
| `/ecosystemdata-handler` | EcosystemData | Manipulação do diretório `EcosystemData`. |
| `/notification` | Notification | Canal de notificações. |
