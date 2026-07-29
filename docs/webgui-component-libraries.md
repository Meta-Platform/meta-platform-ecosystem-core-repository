# Bibliotecas de componentes WebGui

O tipo de pacote `.icomponents` permite que um WebGui reutilize código de
interface pelo mesmo grafo de tarefas usado pelos demais pacotes do ecossistema.
O Core não pressupõe React: o manifesto declara o framework e o builder recebe
um alias e um diretório de fontes.

## Contrato do pacote

Todo pacote contém `metadata/package.json` com um namespace terminado em
`.icomponents` e `metadata/webgui-library.json`:

```json
{
  "alias": "@my-components",
  "framework": "react",
  "source": "src",
  "entry": "index.ts",
  "styles": "styles/index.css",
  "catalog": "catalog/stories.tsx"
}
```

O `webgui-library.taskLoader` valida o manifesto e publica um handle imutável
com os caminhos da raiz, fontes, ambiente, dependências e o próprio manifesto.
O gerador de parâmetros do Essential seleciona automaticamente esse loader para
namespaces `.icomponents`.

## Binding

O host declara a biblioteca como parâmetro e associa o alias ao handle:

```json
{
  "bind-params": {
    "iComponents": "@/i-components.icomponents"
  },
  "componentLibraries": {
    "@i-components": "{{iComponents}}"
  }
}
```

O endpoint WebGui e o host desktop encaminham `componentLibraries` ao
`WebInterfaceBuilder`. O builder acrescenta os aliases, os módulos e os tipos
ao webpack. O cache desktop também inclui as fontes das bibliotecas no
fingerprint, portanto uma alteração compartilhada recompila os consumidores.

## Hierarquia recomendada

- Uma `.icomponents` na camada Base contém tokens, temas, primitivas e estado
  realmente comuns.
- Uma `.icomponents` dentro de um módulo contém apenas componentes próprios
  daquela área.
- O WebGui conserva telas, fluxos e composição específicos do aplicativo.
- Cada biblioteca exporta uma `StoryCollection`; o catálogo agrega essas
  coleções sem copiar os componentes.

Novos adaptadores de frontend podem consumir o mesmo handle. Apenas a etapa de
build precisa interpretar o campo `framework`; o contrato do task loader e o
grafo de binding permanecem iguais.
