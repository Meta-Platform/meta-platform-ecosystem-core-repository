# server-manager.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/server-manager.service`
- **Localização:** `Main.Module/Services.layer/server-manager.service`

## Propósito

Serviço base de **servidor HTTP** do ecossistema. Praticamente toda aplicação
web (`.webapp`/`.webgui`/`.webservice`) declara este serviço como
`@@/server-service`, montando seus endpoints sobre o `HTTPServerService`.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Parâmetros / Dependências |
|-----------|------|---------------------------|
| `HTTPServerService` | `Services/HTTPServer.service` | `params`: `name`, `port`; `bound-params`: `?middlewareService` (opcional) |
| `JWTVerifierMiddlewareService` | `Services/JWTVerifierMiddleware.service` | `params`: `secretKey` |

> O `?` em `?middlewareService` indica dependência **opcional**.
> A interface web é exposta pelo `server-manager.webservice` /
> `server-manager.webapp`. Veja o [README do repositório](../../../README.md).
