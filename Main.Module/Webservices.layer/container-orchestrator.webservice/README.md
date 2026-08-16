# container-orchestrator.webservice

- **Tipo:** serviço web, backend HTTP (`.webservice`)
- **Namespace:** `@/container-orchestrator.webservice`
- **Localização:** `Main.Module/Webservices.layer/container-orchestrator.webservice` (EcosystemCoreRepo)

## Propósito

Expõe por **HTTP** a superfície do runtime de containers, para que uma interface
gráfica não precise falar unix socket. Internamente monta o
`ContainerRuntimeClient` (`@/container-runtime-adapter.service`), que conversa
com o `container-runtime-adapter.app`.

Não é um proxy transparente: entre a rota HTTP e o runtime existem três
comportamentos que valem por si.

### 1. Sanitização de payload

`SanitizeContainerRuntimePayload.ts` limpa a resposta dos `Inspect*` antes de
ela sair: variáveis de ambiente com cara de segredo e caminhos do host viram
valores mascarados. Inspecionar um container não pode ser uma forma oblíqua de
ler a senha que ele recebeu no boot.

### 2. Gate de autorização do export

`ExportContainer`, `ExportImage` e `ExportVolume` levam o filesystem inteiro
embora — são as operações mais sensíveis daqui. `CreateExportAuthorizationGuard.ts`
exige ator autenticado, decisão de autorização positiva e um `reason` informado,
e opera em **fail closed**: sem PEP vinculado, sem socket do IAM ou com o
provedor de decisão fora do ar, o export é **negado**, nunca liberado.

### 3. Auditoria

`CreateAuditRecorder.ts` registra as mutações com ator, ação, recurso e motivo —
e nunca com o conteúdo exportado. Sem sink de auditoria configurado, a operação
acontece e nada é registrado (não há onde escrever); com sink, allow e deny são
registrados igualmente.

## Montagem (`metadata/endpoint-group.json`)

| | |
|---|---|
| **params** | `containerRuntimeSocketPath`, `containerRuntimeServerManagerUrl`, `?needsAuth`, `?iamManagerSocketPath`, `?iamManagerServerManagerUrl` |
| **bound-params** | `serverService`, `commandExecutorLib`, `?authorizationClientLib`, `?auditManagerService` |
| **prefixo** | `/container-orchestrator` |

O `?` marca dependência opcional. `authorizationClientLib` é o **PEP**: uma
aplicação que não tem IAM monta este webservice sem ele — e, nesse caso, as
rotas de export ficam fechadas por consequência do fail closed, não por acidente.

## Endpoints

**Leitura** — `ListContainers`, `ListImages`, `ListNetworks`, `ListVolumes`,
`InspectContainer`, `InspectImage`, `InspectNetwork`, `InspectVolume`,
`GetContainerLogHistory`, `GetExportGuardState`

**Containers** — `StartContainer`, `StopContainer`, `RestartContainer`,
`KillContainer`, `RemoveContainer`

**Imagens** — `RemoveImage`

**Redes** — `CreateNewNetwork`, `RemoveNetwork`, `ConnectContainerToNetwork`,
`DisconnectContainerFromNetwork`

**Volumes** — `CreateNewVolume`, `RemoveVolume`

**Export (gated)** — `ExportContainer`, `ExportImage`, `ExportVolume`

## Testes

```bash
node scripts/test-runtime-payload-sanitization.js
node scripts/test-runtime-unavailability.js
node scripts/test-audit-mutations.js
node scripts/test-export-authorization.js   # exige a authorization-client.lib
```

O último exercita o PEP **real**. A `authorization-client.lib` vive no
VirtualDeskRepo; o script a procura em caminhos conhecidos e aceita
`AUTHORIZATION_CLIENT_LIB_PATH` apontando para ela.
