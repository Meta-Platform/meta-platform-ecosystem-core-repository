# Bibliotecas de UI (`.uilib`)

Uma `.uilib` é uma **biblioteca de componentes de front-end**: fonte TypeScript e
CSS que o webpack compila **dentro do bundle do consumidor**. Não confundir com
uma `.lib`, que é módulo Node carregado por `require()` em tempo de execução.

O tipo permite que um WebGui reutilize código de interface pelo mesmo grafo de
tarefas usado pelos demais pacotes do ecossistema. **O core não pressupõe
React**: o manifesto declara o framework e o builder recebe um alias e um
diretório de fontes. A matriz de CSS não faz parte do tipo — a mecânica é comum,
a estética é de cada repositório.

## Contrato do pacote

`metadata/package.json` com namespace terminado em `.uilib`, e
`metadata/uilib.json`:

```json
{
  "schemaVersion": 1,
  "alias": "@my-components",
  "framework": "react",
  "source": "src",
  "entry": "index.ts",
  "styles": "styles/index.css",
  "catalog": {
    "title": "Meu Repositório / Componentes",
    "scope": "common",
    "stories": "catalog/stories.tsx"
  }
}
```

O `ui-library.taskLoader` valida o manifesto e publica um handle imutável:

| método | devolve |
|---|---|
| `getRootPath()` | raiz do pacote |
| `getSourcePath()` | raiz + `source` do manifesto |
| `getEnvironmentPath()` | ambiente de execução do consumidor |
| `getNodeModulesPath()` | `node_modules` das dependências da própria biblioteca |
| `getFrameworkModulesPath()` | o mesmo diretório, **só** quando esta biblioteca provê o runtime do framework; `undefined` caso contrário |
| `getManifest()` | cópia do manifesto |

O gerador de parâmetros do Essential seleciona esse loader automaticamente para
namespaces `.uilib`.

## Como um consumidor declara a biblioteca

Três lugares, e só três.

**1. `endpoint-group.json` do WebGui** — nomes de parâmetro e o mapa
alias → parâmetro. Não contém namespace.

```json
{
  "bound-params": ["serverService", "myComponents"],
  "endpoints": [{
    "url": "/",
    "type": "web-graphic-user-interface",
    "bound-params": {
      "serverService": "serverService",
      "componentLibraries": { "@my-components": "myComponents" }
    }
  }]
}
```

**2. `boot.json` do host** (`.webapp`, `.desktopapp` ou `.webgui` standalone) —
liga o nome do parâmetro ao **namespace**:

```json
{
  "bound-params": { "myComponents": "@/my-components.uilib" }
}
```

No caso desktop, a seção `gui-host` repassa o mesmo mapa:

```json
"gui-host": {
  "webgui": "myWebgui",
  "componentLibraries": { "@my-components": "myComponents" }
}
```

**3. `tsconfig.json` do WebGui** — `paths`, apenas para o `tsc` e o editor. O
build real usa o alias que `CreateWebpackConfig` gera; o `paths` do pacote é
sobrescrito pelas `compilerOptions` injetadas no ts-loader.

⚠️ **Dívida conhecida nesse terceiro ponto.** O `paths` é um caminho relativo
escrito à mão (`../../../../../ecosystem-core-repository/...`), e a contagem de
níveis não depende só da posição do pacote na hierarquia: ela depende também do
`baseUrl`. Hoje os 11 consumidores escrevem os mesmos cinco níveis, mas por dois
motivos diferentes — os `.webgui` estão dentro de um `.group` e usam
`baseUrl: "."`; a `instance-manager.uilib` está direto na camada, um nível
acima, e usa `baseUrl: "src"`, que devolve o nível. Duas variáveis se cancelando
é coincidência, não desenho: mover um pacote de lugar quebra o `paths` de um
jeito que o build não denuncia.

Pior: o caminho pressupõe que os repositórios estão lado a lado no disco. Isso é
verdade no checkout de desenvolvimento e **não é garantido** na topologia
instalada, onde cada repositório é registrado por caminho próprio.

Não quebra o build (o webpack usa o alias gerado, não o `paths`), mas quebra o
editor e o `tsc --noEmit` avulso de quem clonar diferente. A correção é gerar
um `tsconfig.paths.json` a partir do `packageList` resolvido — a mesma fonte que
`ResolveDependencyPath` já usa —, e o `tsconfig` do pacote passar a estendê-lo.
Registrado como APPUI-196; não foi executado neste projeto.

A resolução de namespace é **plana**: `ResolveDependencyPath` casa nome + sufixo
contra a união de todos os pacotes de todos os repositórios instalados. O caminho
físico (repositório, módulo, camada, grupo) é derivado, não declarado — mudar uma
biblioteca de lugar não exige editar nenhum `boot.json`.

## Dependências

A biblioteca declara as próprias `dependencies`. Quem a consome **herda**: um
`.webgui` não declara `react`, `semantic-ui-react`, `xterm`, `d3` ou qualquer
outra dependência que exista por causa da biblioteca.

**Regra do runtime**: exatamente **uma** `.uilib` da cadeia declara o framework
(`react`/`react-dom`) em `dependencies`; todas as outras declaram em
`peerDependencies`. Sem isso há duas cópias do runtime em disco e o alias do
webpack fica não-determinístico — duas instâncias de React passam no build e
quebram só em execução, com `Invalid hook call`.

`peerDependencies` **não são instaladas** pelo ecossistema: o instalador lê
apenas `dependencies`. `devDependencies` servem exclusivamente ao `tsc --noEmit`
e ao editor na árvore-fonte.

## Ordem de provisionamento

Garantida pelo grafo, sem configuração: `CreateEndpointTaskParams` e
`CreateWindowTaskParams` geram `agentLinkRules` exigindo `status = ACTIVE` para
cada namespace em `bound-params`, e o handle da biblioteca só fica ACTIVE quando
a task de instalação dela emite `FINISHED`. O build do WebGui já espera a
instalação da biblioteca.

## Cache

O fingerprint do `BuildCache` inclui o **conteúdo** das fontes de cada biblioteca
e o `stat` do `node_modules` dela — uma alteração compartilhada recompila os
consumidores.

⚠️ O fingerprint **não inclui caminhos**. Mover uma biblioteca de lugar não muda
o fingerprint: o bundle antigo continua "fresco" e o aplicativo abre normalmente
mesmo se a mudança estiver quebrada. Ao mover ou renomear, apague
`<ambiente>/.generated_data/*.webInterfaceAssets` antes de testar e confirme no
log que houve build real.

## Hierarquia recomendada

- Uma `.uilib` comum com tokens, temas, primitivas e estado realmente
  compartilhados. Na plataforma, é a `i-components.uilib` deste repositório.
- Uma `.uilib` por área, dentro do módulo da área, com o que só faz sentido ali.
- O WebGui conserva telas, fluxos e composição específicos do aplicativo.
- Cada biblioteca exporta uma `StoryCollection`; o catálogo agrega as coleções
  sem copiar os componentes.

Novos adaptadores de front-end podem consumir o mesmo handle: apenas a etapa de
build interpreta o campo `framework`; o contrato do task loader e o grafo de
binding permanecem iguais. É isso que permite a um repositório irmão — que não
depende do Application Repository — montar a própria suíte de UI com outra matriz
de CSS.

## Histórico dos nomes

O tipo nasceu como `.icomponents`, com `objectLoaderType: "webgui-library"` e
manifesto `metadata/webgui-library.json`. Os dois nomes eram ruins: `icomponents`
carrega o nome de um kit específico, e `webgui-library` nomeia o consumidor —
mas o handle já é consumido também pelo caminho desktop. Os demais loaders da
plataforma nomeiam o papel (`nodejs-package`, `endpoint-instance`,
`desktop-window-instance`).

A janela de compatibilidade **está fechada**: `.icomponents`,
`objectLoaderType: "webgui-library"` e `metadata/webgui-library.json` não são mais
reconhecidos em lugar nenhum. O package do loader também foi renomeado para
`ui-library.taskLoader`.

O tipo está especificado no Meta Platform Open Standard, em
`specifications/packages/uilib-manifest-standard.md`.
