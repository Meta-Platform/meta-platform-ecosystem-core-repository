# command-line-runtime-manager.service

- **Tipo:** serviço (`.service`)
- **Namespace:** `@/command-line-runtime-manager.service`
- **Localização:** `Main.Module/Services.layer/command-line-runtime-manager.service`

## Propósito

Executa **pacotes CLI** (interativos) com um **terminal real (PTY)**, dentro do
daemon `executor-manager` (`ecosystem-instance-manager.app`).

Ao contrário de APP/serviço/endpoint/DESKTOP — que o daemon executa in-process —
um CLI precisa de terminal (stdin/stdout/tty). Este serviço spawna o `pkg-exec`
do CLI dentro de um **`node-pty`**, reproduzindo a mesma invocação que o wrapper
`execute-command-line-application` faz, e distribui o I/O do terminal para os
consumidores (o painel `instance-executor-control-panel`, via WebSocket).

## Serviço (`CommandLineRuntimeService`)

| Método | Descrição |
|--------|-----------|
| `RunCommandLinePackage({ packagePath, commandLineArgs, cols, rows })` | Lê o `executableName` do `boot.json`, spawna `pkg-exec` num PTY e retorna `{ terminalId, executableName }`. |
| `AttachTerminal(terminalId, { onData, onExit })` | Assina o I/O do terminal. Retorna função de desassinatura. |
| `WriteToTerminal(terminalId, data)` | Envia teclas do painel para o CLI. |
| `ResizeTerminal(terminalId, cols, rows)` | Redimensiona o terminal. |
| `KillTerminal(terminalId)` | Encerra o processo do CLI. |
| `ListTerminals()` | Lista as sessões de terminal abertas. |

## Dependências

- `node-pty` (npm, binding nativo) — terminal pseudo-tty.
- `@/json-file-utilities.lib` (bound-param `jsonFileUtilitiesLib`) — leitura do `boot.json`.

## Parâmetros

`ecosystemDataPath`, `configurationsDirName`, `npmDependenciesDirName`,
`ecosystemDefaultsFileName`, `metadataDirName`, `startupParamsFileName`,
`bootFileName` — usados para montar a invocação do `pkg-exec`.

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md) e o
> [README do repositório](../../../README.md).
