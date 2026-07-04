# package-process-manager.lib

Gerenciador de processos para **rodar/debugar pacotes** a partir do PackageDeveloper.
Faz `spawn` do executável `run` já instalado (`run package <path>`), captura
stdout/stderr num buffer circular e emite eventos de log ao vivo (streaming à UI).

Serviço `ProcessManager` (param `runCommandPath`) — instância única compartilhada
entre o controller de tasks (Start/Stop/List) e o endpoint de logs.

## API

```js
manager.StartPackage({ id, packagePath, debug })   // spawn run|run-dbg
manager.StopPackage(id)                             // SIGTERM
manager.List()                                      // [{ id, status, pid, debug }]
manager.GetStatus(id)
manager.GetLogs(id)                                 // [{ stream, line, ts }]
const unsub = manager.Subscribe(id, (entry) => ...) // stream ao vivo
```
