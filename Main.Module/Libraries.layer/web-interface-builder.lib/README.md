# web-interface-builder.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/web-interface-builder.lib`
- **Localização:** `Main.Module/Libraries.layer/web-interface-builder.lib` (EcosystemCoreRepo)

## Propósito

Constrói e empacota, com webpack, a interface web de um pacote `.webgui`. É esta
lib que faz um `.webgui` deixar de ser código-fonte e virar um bundle servido em
runtime — por isso nenhum `.webgui` roda sozinho.

Vive no `ecosystem-core` porque é ali que mora a capacidade web da plataforma, e
é injetada nos *task loaders* pelo registry: `endpoint-instance` (core) a usa
para servir a GUI por HTTP, e `desktop-window-instance` (applications) a usa no
modo **GUI-host**, em que o Electron hospeda a interface sem subir webservice.

O export é uma **fábrica**: `(SmartRequire) => WebInterfaceBuilder`. Receber o
`SmartRequire` do chamador é o que permite resolver as dependências npm do
pacote-alvo, e não as desta lib.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `WebInterfaceBuilder.js` | Fábrica do builder: recebe o `SmartRequire` e devolve o construtor de bundles webpack. |

> Veja o [README do repositório](../../../README.md).
