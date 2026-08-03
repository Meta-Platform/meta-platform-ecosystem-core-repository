# container-runtime-adapter.app

- **Tipo:** aplicação (`.app`)
- **Namespace:** `@/container-runtime-adapter.app`
- **Localização:** `Main.Module/Application.layer/container-runtime-adapter.app` (EcosystemCoreRepo)
- **Executável:** `container-runtime-adapter`

## Propósito

A **instância única** que detém o socket do runtime de containers. Monta o
`ContainerRuntimeAdapter` em processo e publica a API `ContainerRuntime` num
unix socket próprio, para que as demais aplicações operem containers **sem
nunca tocar** no socket do Docker/Podman.

O desenho existe por uma razão: quem escreve no socket do runtime controla a
máquina inteira. Concentrando esse acesso num processo só, o privilégio fica
auditável em um lugar, e todo o resto do ecossistema fala com um socket que se
pode governar.

## Parâmetros de inicialização (`metadata/boot.json`)

| Parâmetro | O que é |
|-----------|---------|
| `socket` | Caminho do unix socket que esta aplicação **serve** |
| `serverName` | Nome da instância do servidor (`ContainerRuntimeAdapterInstance`) |
| `dockerSocketPath` | Caminho do socket do runtime que ela **consome** (`/var/run/docker.sock`, ou o socket do Podman) |

Serviços montados: `@@/server-service` (`@/server-manager.service`) e
`@@/container-runtime-adapter-service` (`@/container-runtime-adapter.service`).

## API

Um controller, `ContainerRuntime` (`src/APIs/ContainerRuntime.api.json`), sob a
rota `/container-runtime`, com a superfície completa do adaptador: containers,
imagens, redes, volumes e operações de arquivo em volume.

Consumo pelo cliente: monte `@/container-runtime-adapter.service/services/ContainerRuntimeClient`
apontando `containerRuntimeSocketPath` para o socket servido aqui.

## Permissões

`metadata/permissions.json` declara `execution.ring: RING0`, posse do
`container-runtime-socket` e o mount do socket do runtime do host. As permissões
de escrita (`container:manage`, `image:build`, `image:manage`, `network:manage`,
`volume:manage`) são de risco **crítico** e exigem aprovação; a instalação
também.

## Executar

O executável registrado em `metadata/applications.json` é
`container-runtime-adapter`. Para lançar o pacote diretamente pelo Instance
Executor, com caminho absoluto:

```bash
executor package ~/EcosystemData/repositories/EcosystemCoreRepo/Main.Module/Application.layer/container-runtime-adapter.app
```

> Uma instância por máquina. Duas instâncias disputando o mesmo socket servido
> é erro de configuração, não redundância.
