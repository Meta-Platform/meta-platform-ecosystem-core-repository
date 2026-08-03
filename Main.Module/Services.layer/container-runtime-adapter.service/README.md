# container-runtime-adapter.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/container-runtime-adapter.service`
- **Localização:** `Main.Module/Services.layer/container-runtime-adapter.service` (EcosystemCoreRepo)

## Propósito

A camada de **conexão com o runtime de containers** do ecossistema. Fala com
Docker ou Podman pelo socket da API (ambos expõem a mesma API HTTP; o cliente é
o `dockerode`) e entrega o ciclo de vida completo de containers, imagens, redes
e volumes.

O pacote expõe **duas implementações da mesma superfície**, e essa é a decisão
central aqui:

- `ContainerRuntimeAdapter` — fala **direto** com o socket do runtime. Quem o
  monta passa a ter poder total sobre o runtime da máquina, então é ele que roda
  no processo privilegiado e único (`container-runtime-adapter.app`).
- `ContainerRuntimeClient` — **mesma superfície de métodos**, mas nenhuma
  conexão com o runtime: cada chamada vira um comando para o
  `container-runtime-adapter.app` por unix socket. É o que aplicações comuns
  consomem.

Trocar um pelo outro não muda o código de quem consome — muda **quem tem a
chave do runtime**. A única diferença de superfície é o stream de eventos do
Docker (`RegisterDockerEventListener`), que só existe no adaptador em processo;
no cliente ele lança erro explicando o motivo.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Parâmetros / Dependências |
|-----------|------|---------------------------|
| `ContainerRuntimeAdapter` | `Managers/Container.manager` | `params`: `socketPath` |
| `ContainerRuntimeClient` | `Services/ContainerRuntimeClient.service` | `params`: `containerRuntimeSocketPath`, `containerRuntimeServerManagerUrl`; `bound-params`: `commandExecutorLib` |
| `ContainerRuntimeConnectionManager` | `Managers/ContainerRuntimeConnection.manager` | `params`: `storageDir`, `?connectionsFilePath` |

### ContainerRuntimeConnectionManager — vários runtimes ao mesmo tempo

O `ContainerRuntimeAdapter` conhece **um** runtime, fixado no boot. Isso serve
ao `container-runtime-adapter.app`, que é justamente a instância única dona de
um socket — e não serve a um aplicativo de gestão, onde a pergunta é "com
**quais** runtimes eu falo?".

O `ContainerRuntimeConnectionManager` responde a essa pergunta sem alterar o
adaptador: guarda perfis de conexão (nome, tipo `docker`/`podman`, endpoint) e
instancia **um adaptador por perfil, sob demanda**. Docker e Podman, local e
remoto, convivem.

| Operação | O que faz |
|----------|-----------|
| `ListConnections` / `GetConnection` | Perfis cadastrados (sem material de TLS) |
| `CreateConnection` / `UpdateConnection` / `RemoveConnection` | Cadastro, com validação de nome, tipo e endpoint |
| `TestConnection` / `ProbeEndpoint` | Verifica se há runtime do outro lado e **qual** ele é |
| `GetAdapter` | O adaptador daquela conexão, com a superfície completa |
| `DiscoverConnections` | Runtimes encontrados na máquina, marcando os já cadastrados |

**Endpoints aceitos:** `unix:///var/run/docker.sock`,
`unix:///run/user/1000/podman/podman.sock`, `tcp://host:2375`,
`https://host:2376` (com `tls: { ca, cert, key }`).

Quatro comportamentos que valem por si:

- **Endpoint malformado é recusado, nunca completado por adivinhação.** Um
  endereço sem esquema poderia ser TCP simples ou TLS; escolher sozinho
  significaria conectar em texto claro onde se queria TLS.
- **Cadastrar não conecta.** Um host fora do ar não pode travar o cadastro dos
  outros; o adaptador nasce no primeiro `GetAdapter`.
- **Editar o endpoint descarta o adaptador em cache.** Sem isso, a operação
  continuaria acontecendo no endereço antigo — funcionar no lugar errado é o
  pior resultado possível.
- **O runtime é identificado pelo que ele responde.** Um perfil rotulado
  `docker` apontando para um Podman é *sinalizado* (`runtimeTypeMatches: false`),
  não corrigido em silêncio.

Indisponibilidade é **resposta**, não exceção: `TestConnection` devolve
`{ reachable: false, code }` para a interface poder mostrar "offline" sem
tratar erro linha a linha.

## Superfície

**Containers** — `ListAllContainers`, `CreateNewContainer`, `StartContainer`,
`StopContainer`, `RestartContainer`, `KillContainer`, `RemoveContainer`,
`InspectContainer`, `GetContainerLogHistory`, `ExportContainer`

**Imagens** — `ListAllImages`, `InspectImage`, `RemoveImage`, `ExportImage`,
`BuildImageFromDockerfileString`

**Redes** — `ListAllNetworks`, `InspectNetwork`, `CreateNewNetwork`,
`RemoveNetwork`, `ConnectContainerToNetwork`, `DisconnectContainerFromNetwork`

**Volumes** — `ListAllVolumes`, `InspectVolume`, `CreateNewVolume`,
`RemoveVolume`, `ExportVolume`, e as operações de arquivo dentro do volume:
`ListVolumeEntries`, `PutFileInVolume`, `GetFileFromVolume`, `DeleteVolumeEntry`

**Eventos** — `RegisterDockerEventListener` (só no `ContainerRuntimeAdapter`)

### Como as operações de arquivo em volume funcionam

Volume nomeado não é diretório acessível de fora do runtime. Para ler ou
escrever dentro dele, o adaptador sobe um **container efêmero** com o volume
montado, executa a operação e o descarta. Por isso essas chamadas custam mais
que as demais, e por isso `ExportVolume` precisa da imagem `alpine:latest`.

Os caminhos pedidos passam por `RequireSafeVolumePath` / `RequireSafeFileName`
(em `src/Helpers/ResolveVolumeEntryPath.js`): funções puras, testáveis sem
runtime nenhum, que impedem escapar do ponto de montagem.

## Dependências

- **npm:** `dockerode`
- **Ecossistema:** `@/command-executor.lib` (só o `ContainerRuntimeClient`)

### `require` de dependência npm tem hora certa: no topo do módulo

O executor da plataforma aponta o `NODE_PATH` para as dependências do pacote
**apenas enquanto o módulo é carregado**, e o restaura logo depois (é o que
`CreatePackageHandle` faz, e o `exec-pkg` segue o mesmo modelo). Um
`require("dockerode")` adiado — feito dentro de uma função, na primeira
chamada — procura num caminho que já não existe mais e falha com
`MODULE_NOT_FOUND`, **mesmo com a dependência instalada corretamente**.

Custou um provisionamento inteiro para aparecer (CTMG-13): fora do executor,
com `node --test` ou `node -e`, o `require` tardio funciona perfeitamente.

Por isso o `ContainerRuntimeConnectionManager` carrega o adaptador e o cliente
no topo, dentro de um `try/catch`: onde o cliente não está instalado, cadastrar
e listar conexões continua funcionando (é trabalho de arquivo) e só **conectar**
falha, com `RUNTIME_CLIENT_UNAVAILABLE` em vez de um erro de resolução de módulo.

> **Ao editar este pacote com o ecossistema no ar:** o daemon
> `executor-manager` guarda os módulos já carregados no cache de `require` do
> Node. `repo update` troca o arquivo no disco, mas o processo continua
> executando a versão antiga — é preciso **reiniciar o daemon** para a mudança
> valer.

## Testes

```bash
node --test          # helpers puros, resolução de endpoint, descoberta e conexões
node scripts/test-volume-files.js   # operações de arquivo em volume (exige runtime)
```

## Quem consome

- `container-runtime-adapter.app` — monta o `ContainerRuntimeAdapter` e publica
  a API por socket
- `container-orchestrator.webservice` — monta o `ContainerRuntimeClient` e expõe
  a API por HTTP
