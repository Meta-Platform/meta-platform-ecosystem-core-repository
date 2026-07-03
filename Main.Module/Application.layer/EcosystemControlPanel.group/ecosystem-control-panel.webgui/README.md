# ecosystem-control-panel.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/ecosystem-control-panel.webgui`
- **Localização:** `Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webgui`

## Propósito

Front-end (React/TSX) do **painel de controle do ecossistema**. É um dos pacotes
do grupo [EcosystemControlPanel](../) — junto com o `.webservice` (API), o
`.service`, o `.webapp` (composição, `eco-panel`) e o `.desktopapp`
(janela Electron, `eco-panel-desktop`).

## Estrutura (`src/`)

Aplicação web típica da plataforma: `Pages/`, `Containers/`, `Components/`,
`Lists/`, `Modals/`, `Hooks/`, `Actions/`, `Reducers/`, `Mappers/`, `Utils/`,
`index.tsx`/`index.html` e `routes.config.json`.

## Boot (`metadata/boot.json`)

Sobe um `@@/server-service` (`@/server-manager.service`) e expõe seu
`endpoint-group` próprio (`@//endpoint-group`), além de montar o
`@/server-manager.webservice`. Parâmetros: `port`, `serverName`,
`serverManagerUrl`, `RT_ENV_GENERATED_DIR_NAME`, `isWatch`.

> Veja o [README do repositório](../../../../README.md).
