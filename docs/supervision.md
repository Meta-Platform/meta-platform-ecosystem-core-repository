# Supervisão — Ecosystem Core

Como o ecossistema **observa e controla** as instâncias em execução.

## Camadas

1. **Supervisor Socket (transporte)** — cada instância iniciada com supervisão
   expõe um servidor **gRPC sobre socket Unix** em
   `EcosystemData/supervisor-sockets/` (nome vindo de `applications.json`, ex.:
   `instance-manager.sock`). Contrato:
   [Package Executor RPC Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/package-executor-rpc-standard.md)
   · transporte:
   [Supervisor Socket Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/supervisor-socket-standard.md).

2. **instance-supervisor.service** (`InstanceMonitoringManager`) — serviço deste
   repositório que **monitora** as instâncias e publica notificações de status
   (consome `supervisorLib` e o `notificationHubService`). Usado pelos painéis
   (`eco-panel`, `executor-panel`).

3. **CLI `supervisor`** — cliente de linha de comando (vem do
   [essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository),
   `instance-supervisor.cli` + `supervisor.lib`).

## Operações (CLI `supervisor`)

```bash
supervisor sockets                          # lista os sockets de supervisão
supervisor status instance-manager.sock     # status do processo
supervisor tasks  instance-manager.sock     # tasks em execução
supervisor log    instance-manager.sock     # streaming de log
supervisor kill   instance-manager.sock     # encerra o processo
supervisor show task <id> --socket instance-manager.sock
```

## Operações expostas pelo socket (gRPC)

`KillInstance`, `GetStatus`, `ListTasks`, `GetTask`, `LogStreaming`,
`StatusChangeNotification`, `GetStartupArguments`, `GetProcessInformation`.

> O socket só existe enquanto o processo roda. Se um `supervisor status` falha,
> a instância correspondente provavelmente não está no ar.

Ver: [instance-lifecycle.md](./instance-lifecycle.md) · [services.md](./services.md).
