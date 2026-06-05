# server-manager.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/server-manager.webgui`
- **Localização:** `Main.Module/Application.layer/ServerManager.group/server-manager.webgui`

## Propósito

Front-end (React/TSX) do **gerenciador de servidores**. Faz parte do grupo
[ServerManager](../), junto com o `.webapp` (e apoiado pelo
`@/server-manager.webservice` / `@/server-manager.service`), oferecendo a
interface de administração dos servidores HTTP do ecossistema.

## Estrutura (`src/`)

`Pages/`, `Containers/`, `Components/`, `List/`, `Hooks/`, `Actions/`,
`Reducers/`, `Mappers/`, `Styles/`, `Utils/`, `index.tsx`/`index.html`,
`routes.config.json`.

## Boot (`metadata/boot.json`)

Sobe um `@@/server-service` (`@/server-manager.service`) e expõe seu
`endpoint-group` próprio, montando também o `@/server-manager.webservice`.
Parâmetros: `port`, `serverName`, `serverManagerUrl`,
`RT_ENV_GENERATED_DIR_NAME`.

> Veja o [README do repositório](../../../../README.md).
