# process-supervisor.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/process-supervisor.lib`
- **Localização:** `Main.Module/Libraries.layer/process-supervisor.lib`

## Propósito

Supervisor de processo com **auto-restart**. Mantém um processo vivo,
reiniciando-o sempre que ele terminar, com backoff exponencial entre tentativas
(reset quando o processo se mostra estável).

Preenche uma lacuna do ecossistema (não havia keep-alive/respawn). Usado pelo
`instance-manager-daemon.cli` para manter o daemon `executor-manager` de pé.

## Uso

```js
const CreateProcessSupervisor = processSupervisorLib.require("CreateProcessSupervisor")
const supervisor = CreateProcessSupervisor({
    command: "/caminho/para/executor-manager",
    onEvent: (e) => console.log(e)
})
supervisor.Start()   // spawna e re-spawna no exit; SIGINT/SIGTERM encerram limpo
```

## Exports (`src/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `CreateProcessSupervisor.js` | Fábrica do supervisor: `Start`/`Stop`/`IsRunning`. |

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md).
