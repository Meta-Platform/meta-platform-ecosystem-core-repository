# instance-manager-daemon.cli

- **Tipo:** aplicação de linha de comando (`.cli`)
- **Namespace:** `@/instance-manager-daemon.cli`
- **Executável:** `instance-manager-daemon`
- **Localização:** `Main.Module/InstanceManagerApplication.layer/instance-manager-daemon.cli` (EcosystemCoreRepo)

## Propósito

Sobe e **mantém vivo** o daemon `executor-manager`
(`ecosystem-instance-manager.app`) com **auto-restart**: se o daemon cair, é
reiniciado automaticamente (backoff exponencial, via `@/process-supervisor.lib`).

É o ponto de entrada recomendado para deixar o Instance Manager rodando de forma
supervisionada, em vez de iniciar o `executor-manager` diretamente (que roda em
foreground e não reinicia sozinho).

## Uso

```bash
instance-manager-daemon start
```

Encerrar com Ctrl+C (SIGINT) — o supervisor mata o daemon e sai limpo. Para
autostart no login, invoque este comando pelo mecanismo de sessão do SO
(o ecossistema não possui autostart próprio).

## Comandos

| Comando | Descrição |
|---------|-----------|
| `start` | Supervisiona o `executor-manager` com auto-restart. |

## Dependências

- `@/process-supervisor.lib` (bound-param `processSupervisorLib`).

## Parâmetros (`metadata/startup-params.json`)

`ecosystemDataPath`, `executablesDirName` (dir dos executáveis) e
`targetExecutable` (`executor-manager`).

`instanceManagerSocketPath` (socket removido antes de cada restart para evitar
EADDRINUSE) e `supervisorSocketPath` vêm de `metadata/socket-params.json`: são
**referências** aos sockets de outros componentes, resolvidas pela
[resource-params-handler.lib](../../../../essential-repository/Runtime.Module/MetadataHelpers.layer/resource-params-handler.lib/README.md)
— por isso o caminho não aparece mais copiado aqui.

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md).
