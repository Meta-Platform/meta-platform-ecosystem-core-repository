# Meta System Retro-Brutalist UI — guia de estilo

Guia de reuso do design system para **todos os aplicativos** da plataforma. O
objetivo é que um aplicativo novo pareça parte da mesma família sem reinventar
token, shell ou componente.

> **Estilo oficial: Meta System Retro-Brutalist UI** — desktop técnico retrô:
> superfícies em papel/off-white, bordas escuras, grid sutil, tipografia forte,
> sombras duras, acentos de estado, componentes que parecem objetos de sistema.

Este documento morava dentro do `ecosystem-control-panel.webgui`, que foi onde a
estética nasceu. Ele não podia continuar lá: um consumidor não é dono do padrão
que os outros doze seguem. A matriz e o guia agora moram juntos, na biblioteca.

## 1. A cadeia de estilos

Um aplicativo importa **um** arquivo:

```ts
import "@i-components/styles/index.css"   // TODA a matriz do design system
import "./Styles/meu-app.css"             // só o CSS de produto (.meuapp-*)
```

`index.css` encadeia, nesta ordem, e a ordem importa:

| folha | o que é |
|---|---|
| `tokens.css` | só `:root` com os tokens `--mp-*`. Nenhum seletor de componente. |
| `base.css` | normalização própria: `box-sizing`, `body{margin:0}`, margens de `h1..h5`/`p` e `html{font-size:14px}` |
| `theme-retro-brutalist.css` | a pintura: papel + grid, tipografia, links, código, seleção, foco, scrollbars |
| `components.css` / `controls.css` | as classes `.mp-*` |
| `themes.css` | os cinco temas, por `data-theme` no `<html>` |
| `advanced-runtime.css` / `advanced-authoring.css` | os componentes pesados, e a sobreposição das folhas de terceiro (xterm, reactflow) |

**Não há folha de terceiro na base.** Até o APPUI-117 a primeira linha era
`@import "semantic-ui-css/semantic.css"`, e duas folhas existiam para
sobrepô-la. O kit não embrulha mais o Semantic: substituiu. Nem a biblioteca
pode importá-lo — o lint falha.

O `html{font-size:14px}` de `base.css` não é escolha estética: é a base de `rem`
contra a qual treze aplicativos foram escritos. Mudá-lo reescala a plataforma.

## 2. Regras que não se negociam

- **Nada de cor, borda ou sombra literal em tela.** Sempre `var(--mp-*)`.
- **`--mp-border` é *shorthand*** (`2px solid var(--mp-line)`). Escreve-se
  `border: var(--mp-border)`. Usá-lo como cor produz
  `2px solid 2px solid #3a3a3a`, que é inválido — e a borda simplesmente não
  aparece. Já aconteceu em 4 regras.
- **Nunca `var(--mp-x, reserva)`.** A reserva mascara nome errado de token: o
  CSS "funciona" pintando fora do tema, e ninguém descobre. Foi encontrado em
  três aplicativos. Um token que não existe tem de aparecer.
- **Um aplicativo não define `--mp-*`.** Definir é bifurcar a matriz. Hoje a
  plataforma tem **zero** definições fora do kit, e o lint existe para manter.
- **Um aplicativo não redefine `.mp-*`.** A variação nasce no kit como
  modificador, com história no catálogo. O CSS de produto usa prefixo próprio.
- **Escala de bordas**: `--mp-border-thin` (1px) para componente interno,
  `--mp-border`/`--mp-border-strong` (2px) para superfície estrutural.

## 3. O que existe no kit

Tudo abaixo vem de `@i-components`.

| família | componentes |
|---|---|
| Primitivas | `Surface`, `Stack`, `Badge` |
| Controles | `Button`, `IconButton`, `ButtonGroup`, `Toolbar`, `Icon` |
| Entrada | `FormField`, `TextInput`, `TextArea`, `SelectInput`, `CheckboxInput`, `RadioInput`, `SearchInput` |
| Dados | `Panel`, `ListRow`, `DataTable`, `TreeRow`, `ObjectCard`, `Tile`, `TileRow`, `KeyValueList`, `Tabs`, `TabPanel`, `Accordion`, `CodeBlock` |
| Cabeçalhos | `PageMasthead`, `EntityHeader`, `StatusStrip`, `StatusChip`, `SystemBanner` |
| Sobreposições | `Dialog`, `ConfirmDialog`, `Drawer`, `Tooltip`, `Popover`, `Menu`, `ContextMenu` |
| Feedback | `Spinner`, `LoadingOverlay`, `ProgressBar`, `Banner`, `EmptyState`, `Skeleton*`, `ToastStack` |
| Shell | `AppShell`, `Topbar`, `NavRail`, `ContentArea`, `StatusBar` |
| Status | `StatusBadge`, `GetStatusMeta`, `GetStatusTone`, `GetSeverityRank` |
| Técnico | `CopyableMonoText`, `TruncateMiddle` |
| **Pesados** | `Terminal`, `TimeSeriesChart`, `LogViewer`, `DiagramCanvas`, `MarkdownView`, `MarkdownEditor`, `CodeEditor` |

O catálogo vivo é o `ui-catalog.webgui`: cada componente exportado tem
**exatamente uma** história, com snippet de uso e tabela de props. Promoveu
componente ao kit, escreveu a história — é a regra que mantém o catálogo
completo em vez de decorativo.

## 4. Quem pinta em JavaScript

`Terminal`, `TimeSeriesChart`, `DiagramCanvas` e o minimapa do `CodeEditor` não
enxergam CSS: xterm, d3 e reactflow recebem cor por prop. Para eles existe
`src/theme/palette.ts`:

```ts
import { useTokenPalette, useDiagramPalette, ReadToken } from "@i-components"
```

Ele lê os tokens `--mp-*` do documento e **relê quando `data-theme` muda**.

Isto não é conveniência: era o buraco por onde a estética vazava. Os diagramas
da plataforma tinham duas tabelas de hexadecimal (`#dbeafe`, `#3b82f6`,
`#7c3aed`) que não saíam de token nenhum — eram a única superfície que ignorava
o tema. Se você for pintar em canvas ou por prop, a cor sai daqui.

Desenho já decidido: o nó de diagrama é **superfície plana + borda de acento**,
sem tinta pastel por tipo. Não há token de tint por acento, e inventar um pastel
seria justamente a cor que não segue o tema. A cor do tipo vive na borda.

## 5. Armadilhas do kit que já custaram tempo

- `Tabs` é **só a barra**; o painel é `TabPanel` (com `keepMounted` quando
  remontar for caro).
- Em **coluna flex**, `Tabs`/`EntityHeader`/`Toolbar`/`Banner` são espremidos a
  zero e **somem**. Dê `flex: 0 0 auto`.
- `.mp-table` **não corta** conteúdo de célula — path longo passa por
  `CopyableMonoText`.
- `TreeRow` e `ListRow` desenham ícone por nome **ou** por `iconNode`; para
  ícone-imagem, `iconNode`.
- Ícone que não existe no conjunto de símbolos renderiza um **marcador visível**,
  não vazio — de propósito, para o erro aparecer.

## 6. Padrões de página

| padrão | estrutura | exemplo |
|---|---|---|
| Overview | Masthead + tiles de status + ações + atividade | Home do control panel |
| Collection | `PageMasthead` + `StatusStrip` + grade de `ObjectCard` ou tabela | Executáveis, Sockets |
| Entity detail | `EntityHeader` + `Tabs`/`TabPanel` + conteúdo | Ambiente, Repositório, Pacote |
| Config editor | `PageMasthead` + `SystemBanner` + `Accordion` + valores mono | Arquivos de configuração |

## 7. Idioma

**UI técnica em inglês** (run/install/inspect). Documentação pode ser PT. Não
misturar PT/EN no mesmo componente.

## 8. Checklist para um aplicativo novo

- [ ] Declara `@i-components` nos **três** lugares: `endpoint-group.json` do
      `.webgui`, `boot.json` do host, e `gui-host.componentLibraries` no
      `.desktopapp`. Mais o alias no `tsconfig.json`, que serve só ao editor.
- [ ] Importa **só** `@i-components/styles/index.css`.
- [ ] Nenhuma cor, borda ou sombra literal.
- [ ] Nenhum `--mp-*` definido, nenhum `.mp-*` redefinido.
- [ ] **Nenhuma dependência de UI no `package.json`** — react, xterm, d3,
      reactflow e marked vêm da biblioteca. Um `.webgui` declara só o que o
      próprio código importa.
- [ ] Lista usa `PageMasthead` + `StatusStrip`; cartão usa `ObjectCard`;
      detalhe usa `EntityHeader`.
- [ ] Path/hash usa `CopyableMonoText`; aviso usa `SystemBanner`.
- [ ] Status sempre **texto + ícone + cor**, via `StatusBadge` — nunca só cor.
- [ ] Funciona em 1288×832 sem rolagem horizontal.
- [ ] `node .../scripts/lint-ui-kit.js` verde, e o gatilho instalado
      (`scripts/install-lint-hooks.js`).

## 9. Onde as coisas moram

- Componentes: `i-components.uilib/src/components/`
- Tokens, temas e classes: `i-components.uilib/src/styles/` (entrada `index.css`)
- Paleta em JS: `i-components.uilib/src/theme/palette.ts`
- Catálogo vivo: `ui-catalog.webgui`, no Application Repository
- O tipo de pacote `.uilib`: `repos/ecosystem-core-repository/docs/ui-libraries.md`
