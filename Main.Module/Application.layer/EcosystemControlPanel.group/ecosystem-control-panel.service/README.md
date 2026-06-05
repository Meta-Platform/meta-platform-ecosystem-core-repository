# ecosystem-control-panel.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/ecosystem-control-panel.service`
- **Localização:** `Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.service`

## Propósito

Camada de **serviços do painel de controle do ecossistema**
([EcosystemControlPanel.group](../)). Fornece os serviços de back-end consumidos
pelo `ecosystem-control-panel.webservice`/`.webgui`/`.webapp` (`eco-panel`).

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (`bound-params`) |
|-----------|------|-------------------------------|
| `EnvironmentHandlerService` | `Services/EnvironmentHandler.service` | `@/json-file-utilities.lib`, `@@/ecosystemdata-handler-service` |
| `EcosystemDataHandlerService` | `Services/EcosystemDataHandler.service` | `params`: `installDataDirPath` |
| `NotificationHubService` | `Services/NotificationHub.service` | — |

> Faz parte do grupo **EcosystemControlPanel**. Veja o
> [README do repositório](../../../../README.md).
