# ecosystem-control-panel.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/ecosystem-control-panel.webgui`
- **Localização:** `Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webgui` (EcosystemCoreRepo)

## Propósito

Front-end (React/TSX) do **painel de controle do ecossistema**. É um dos pacotes
do grupo [EcosystemControlPanel](../) — junto com o `.webservice` (API), o
`.service`, o `.webapp` (composição, `eco-panel`) e o `.desktopapp`
(janela Electron, `eco-panel-desktop`).

## Execução

Não é executada de forma independente: é compilada em runtime pelo loader
`web-graphic-user-interface`, quando o `.webapp` ou o `.desktopapp` do grupo
sobe.

## Estrutura (`src/`)

Aplicação web típica da plataforma: `Pages/`, `Containers/`, `Components/`,
`Lists/`, `Modals/`, `Hooks/`, `Actions/`, `Reducers/`, `Mappers/`, `Utils/`,
`index.tsx`/`index.html` e `routes.config.json`.

## Boot (`metadata/boot.json`)

Sobe um `@@/server-service` (`@/server-manager.service`) e expõe seu
`endpoint-group` próprio (`@//endpoint-group`), além de montar o
`@/server-manager.webservice`. Parâmetros: `port`, `serverName`,
`serverManagerUrl`, `RT_ENV_GENERATED_DIR_NAME`, `isWatch`.

## Estilo

O guia de estilo é do kit de UI da plataforma, na
[`i-components.uilib`](../../../../UserInterface.Module/Libraries.layer/i-components.uilib/docs/ui-style-guide.md).

Deste painel são apenas: `src/Styles/control-panel.css` (CSS de produto, prefixo
`.ecp-`, escrito sobre os tokens do kit — não redefine nenhuma classe dele) e os
componentes finos em cima do kit (`Breadcrumbs`, `CopyValue`, `PackageIcon`,
`ToastContainer`).

> Veja o [README do repositório](../../../../README.md).
