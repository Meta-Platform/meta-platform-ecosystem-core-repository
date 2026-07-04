# api-authoring.lib

Núcleo compartilhado de **autoria de APIs** para pacotes `.webservice` (edição
visual do APIDesigner). Persistência em `fs` puro — cada API é um arquivo
`<name>.api.json` (`{ name, endpoints: [{ summary, method, path, parameters }] }`)
dentro de `apisDir`. Não depende de lowdb.

Reutilizada por `api-designer.webservice` (e disponível para CLI).

## API

```js
const store = apiAuthoringLib.require("InitializeApiAuthoring")(apisDir)
await store.ListAPIs()                                  // ["minha-api", ...]
await store.GetAPI(name)                                // { name, endpoints }
await store.ListEndpoints(name)                         // [ ...endpoints ]
await store.CreateAPI(name)
await store.CreateEndpoint({ api, endpoint, method })
await store.UpdatePath({ api, endpoint, path })
await store.UpdateMethod({ api, endpoint, method })
await store.UpdateParameters({ api, endpoint, parameters })
```
