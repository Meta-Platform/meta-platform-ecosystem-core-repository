# instance-supervisor.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/instance-supervisor.service`
- **Localização:** `Main.Module/Services.layer/instance-supervisor.service`

## Propósito

Serviço de **monitoramento de instâncias**: acompanha os processos/instâncias em
execução (via sockets de supervisão) e publica notificações de status.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (`bound-params`) |
|-----------|------|-------------------------------|
| `InstanceMonitoringManager` | `Managers/InstanceMonitoring.manager` | `@@/ecosystemdata-handler-service`, `@/supervisor.lib`, `@/json-file-utilities.lib`, `@@/notification-hub-service` |

Parâmetros (`params`): `ecosystemDefaultsFileRelativePath`.

> Usado pelos painéis (`ecosystem-control-panel`,
> `instance-executor-control-panel`). A interface de supervisão de baixo nível é
> a do [Package Executor RPC](../../../../../Meta-Platform/meta-platform-open-standard/specifications/package-executor-rpc.md).
> Veja o [README do repositório](../../../README.md).
