# Ciclo de Vida de uma Instância — Ecosystem Core

Como um package vira uma **instância em execução** dentro do ecossistema. Para o
fluxo geral da plataforma, ver
[execution-flow](https://github.com/Meta-Platform/.github/blob/main/docs/execution-flow.md).

## Do comando à instância

```
executor-manager  (executável → ecosystem-instance-manager.app)
   ↓ Package Executor cria um Runtime Environment
   ↓ metadata-hierarchy.json → execution-params.json
   ↓ Task Executor instancia os serviços-núcleo (object loaders):
        server-manager, repository-manager, task-executor-machine,
        environment-runtime, ecosystem-manager
   ↓ a aplicação fica ATIVA, supervisionada em instance-manager.sock
```

A partir daí, novas execuções de pacotes são coordenadas pelos serviços:

```
pedido de execução de um package
   → ecosystem-manager.service (orquestra)
       → repository-manager.service (localiza o package)
       → environment-runtime-manager.service (prepara ambiente + gera execution params)
           → task-executor-machine.service (executa o plano)
               → object loaders instanciam application/service/endpoint
                   → Package Instance no ar
                       → Supervisor Socket (gRPC) acompanha status/tasks/log
```

## Estados

Cada unidade (task) percorre os estados de `TaskStatus`
(`AWAITING_PRECONDITIONS → … → ACTIVE`/`FINISHED`, ou `FAILURE`), e o processo
tem um `ExecutionStatus` (`STARTING → RUNNING`/`ERROR`). Ambos são observáveis via
[supervisão](./supervision.md). Definições em
[Package Executor RPC Standard](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/specifications/package-executor-rpc-standard.md).

## Operando o ciclo

```bash
start-instance-manager                    # sobe a instância principal
supervisor status instance-manager.sock   # acompanha
executor environments                     # ambientes em execução
executor tasks                            # tarefas no task executor
executor show task <id>                   # detalhe de uma task
```

Ver: [services.md](./services.md) ·
[runtime-environment-management.md](./runtime-environment-management.md) ·
[supervision.md](./supervision.md).
