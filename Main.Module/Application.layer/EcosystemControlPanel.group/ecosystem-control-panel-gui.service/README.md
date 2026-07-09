# ecosystem-control-panel-gui.service

Serviço especializado em **servir a GUI** (`ecosystem-control-panel.webgui`) da
aplicação Electron **sem webservices HTTP** (modo *GUI-host* — ver
`desktop-window-instance.lib`).

**Compõe** os 9 controllers já existentes do `ecosystem-control-panel.webservice`
(InstancesSupervisor, ApplicationsAndPackages, Executables, Environments, Sources,
Configurations, HostActions, EcosystemData, Notification), requeridos via o handle
do pacote. **Não duplica lógica** — a webservice segue como fonte única
(dual-transport).

Expõe:
- `Invoke(serviceName, method, data)` — request/response; espelha o contrato HTTP
  (0/1/2+ params).
- `InvokeStream(serviceName, method, data, wsShim)` — **streaming** (WebSocket):
  recebe do host um objeto ws-like (mesma API do `ws` do express-ws) e o entrega
  ao método WS do controller (LogStreaming, InstanceOverviewChange,
  StreamNotifications). Espelha o contrato WS
  (0 → `method(ws)`; 1 → `method(ws, valor)`; 2+ → `method(ws, objeto)`).
- `GetManifest()` — `{ apiName: apiTemplate }` (o `.api.json` inteiro; o renderer
  reconstrói a superfície e distingue WS de HTTP).
- `GetIcon({ kind, args })` — caminho de arquivo do ícone (`package` |
  `executable`), servido pelo protocolo `metaicon://`.

Bound-params: `ecosystemdataHandlerService`, `notificationHubService`,
`repositoryManagerService`, `instanceMonitoringManager`,
`environmentHandlerService`, `jsonFileUtilitiesLib`, `ecosystemInstallUtilitiesLib`,
`ecosystemControlPanelWebservice` (handle) + param `ecosystemDefaultsFileRelativePath`.
