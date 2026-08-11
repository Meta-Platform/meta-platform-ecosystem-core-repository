# Meta System Retro-Brutalist UI — Style Guide

Guia de reuso do design system para **todos os painéis** da Meta Platform (ex.:
`ecosystem-control-panel.webgui`, `virtual-desk.webgui`, `repository-manager-panel.webgui`).
O objetivo é que qualquer painel novo pareça parte da mesma família sem reinventar
tokens, shell ou componentes.

> Estilo oficial: **Meta System Retro-Brutalist UI** — desktop técnico retrô:
> superfícies em papel/off-white, bordas escuras, grid sutil, tipografia forte,
> sombras duras, acentos de estado, componentes que parecem objetos de sistema.

## 1. Estrutura de estilos

O design system **não mora mais neste pacote**. Ele é a biblioteca de UI
`i-components.uilib` (tipo de pacote `.uilib`, alias `@i-components`), e este painel a
consome como qualquer outro aplicativo:

```ts
import "@i-components/styles/index.css"   // TODA a matriz do design system
import "./Styles/control-panel.css"       // só o CSS de produto deste painel (.ecp-*)
```

`@i-components/styles/index.css` já encadeia, na ordem certa: a folha base do Semantic,
`tokens.css`, `CorporateTheme.css`, `theme-retro-brutalist.css`, `components.css`,
`controls.css` e `themes.css`.

- **tokens.css** — só `:root` com tokens `--mp-*` (cores paper/ink/lines/accents/
  status/terminal, tipografia, espaçamento, radius, bordas, sombras duras, z-index).
- **theme-retro-brutalist.css** — fundo papel+grid, overrides do Semantic UI
  (botões táteis, ledger tables, badges, modais como janelas), e a ponte
  `--eco-*` → `--mp-*` (compat. com a base legada).
- **components.css** / **controls.css** — classes `.mp-*` (masthead, status strip,
  object card, entity header, tiles, banners, copyable, botões, inputs).

**Regras:**
- nada de cor/borda/sombra hardcoded em telas — sempre `var(--mp-*)`;
- escala de bordas: `--mp-border-thin` (1px) para componentes internos,
  `--mp-border`/`--mp-border-strong` (2px) para superfícies estruturais
  (atenção: `--mp-border` é *shorthand*, escreve-se `border: var(--mp-border)`);
- **nunca** `var(--mp-x, reserva)` — um token errado tem de aparecer, não ser mascarado;
- o CSS de produto do painel fica em `src/Styles/control-panel.css`, sempre com prefixo
  `.ecp-` e **nunca** redefinindo uma classe `.mp-*`.

## 2. Componentes primitivos (todos de `@i-components`)

| Componente | Uso |
|---|---|
| `PageMasthead` | Cabeçalho de página: ícone + título + subtítulo + ações + faixa de contexto. **Toda tela principal começa com ele.** |
| `StatusStrip` + `StatusChip` | Faixa de contadores/filtros. Chip estático (contador) ou clicável (filtro) com `active`. Tons: neutral/success/warning/danger/info. |
| `ObjectCard` | Card canônico de entidade (executável, pacote, repo…). Slots: ícone (`icon` ou `iconNode`) \| título+status / meta(mono) / chips+ação. Título **ink**, não azul. |
| `EntityHeader` | Cabeçalho de detalhe de entidade: `iconNode`, título, `typeLabel`, `status` (StatusBadge), `badges`, `meta`, `technicalRef` (copiável), `actions`. |
| `CopyableMonoText` | Dado técnico (path/hash/socket) mono, truncamento central (`maxChars`), botão copiar. |
| `SystemBanner` | Faixa read-only/aviso. Tons: info/readonly/warning/danger/success. Ícone+título+texto (nunca só cor). |
| `StatusBadge` | Registro único status↔tom↔ícone↔severidade da plataforma. |
| `Tile`/`TileRow`, `Panel`, `ListRow`, `DataTable`, `TreeRow`, `KeyValueList`, `Tabs`, `CodeBlock` | Exibição de dados. |
| `Button`, `IconButton`, `ButtonGroup`, `Toolbar`, `Icon`, inputs (`FormField`, `TextInput`, `SearchInput`, `SelectInput`, `CheckboxInput`) | Controles. |
| `Dialog`, `ConfirmDialog`, `Drawer`, `Tooltip`, `Popover`, `Menu`, `ContextMenu` | Sobreposições. |
| `Spinner`, `LoadingOverlay`, `ProgressBar`, `Banner`, `EmptyState`, `Skeleton*`, `ToastStack` | Feedback. |

Locais deste painel (fininhos, em cima do kit): `Breadcrumbs`, `CopyValue`, `PackageIcon`,
`ToastContainer`.

**Armadilhas do kit** (já custaram tempo em outros painéis):
- `Tabs` é **só a barra** — o painel da aba é responsabilidade da tela;
- em coluna flex, `Tabs`/`EntityHeader`/`Toolbar`/`Banner` são espremidos a zero e somem:
  dê `flex: 0 0 auto`;
- `.mp-table` **não corta** conteúdo de célula — path longo passa por `CopyableMonoText`;
- `TreeRow`/`ListRow` desenham ícone **só por nome**; ícone-imagem exige `ObjectCard`
  (que tem `iconNode`).

## 3. Shell compartilhado

- **TopBar** (`MainMenu`): barra de sistema (borda inferior forte), logo, breadcrumb
  da seção ativa, chip do workspace path, notificações.
- **SidebarNav** (`EcosystemNavigator`): árvore paper-2, busca fixa, item ativo com
  faixa lateral + tint, contadores à direita.
- **RuntimeDock** (`LogDock`): dock escuro (`--mp-terminal-bg-2`), faixa superior por
  estado de conexão (verde/atenção/erro), abas de stream; janelas de log de instância
  com titlebar `--mp-titlebar-runtime` e corpo `--mp-terminal-bg`. Só observa logs —
  executar pacote é papel do Instance Executor Panel.
- **NotificationDrawer** (`ControlPanel.page`): header paper-2 + borda forte, chips de
  filtro (all/errors/runtime/system), cards com faixa de severidade, agrupamento de
  repetidos, line-clamp.

## 4. Padrões de página

| Padrão | Estrutura | Exemplos |
|---|---|---|
| **Overview** | Masthead + tiles de status + quick actions + activity | Home (Operations Overview) |
| **Collection** | `PageMasthead` + `StatusStrip` + grade `ObjectCard`/ledger table | Executables, Supervisor Sockets |
| **Entity detail** | `EntityHeader` + tabs + conteúdo | Executable/Environment/Repository/Socket/Task detail |
| **Config editor** | `PageMasthead` + `SystemBanner` + grupos colapsáveis + valores mono | Config Files |

## 5. Idioma

**UI técnica em inglês** (termos de domínio e ações: run/install/inspect/…).
Documentação pode ser PT. Não misturar PT/EN no mesmo componente.

## 6. Checklist para um painel novo

- [ ] Declara `@i-components` nos 3 lugares (boot.json do `.webgui`, `endpoint-group.json`,
      `gui-host.componentLibraries` do `.desktopapp`) + alias no `tsconfig.json`.
- [ ] Importa **só** `@i-components/styles/index.css` (nada de cópia local da matriz).
- [ ] Nenhuma cor/borda/sombra hardcoded (tudo `var(--mp-*)`).
- [ ] Telas de lista usam `PageMasthead` + `StatusStrip`.
- [ ] Cards usam `ObjectCard`; detalhes usam `EntityHeader`.
- [ ] Paths/hashes usam `CopyableMonoText`.
- [ ] Avisos/read-only usam `SystemBanner`.
- [ ] Status sempre texto+ícone+cor (via `StatusBadge`).
- [ ] Botões: variantes semânticas (primary/secondary/basic); `basic` colorido = outline.
- [ ] Terminais/logs usam os tokens `--mp-terminal-*`.
- [ ] Funciona em 1288×832 sem scroll horizontal.

## 7. Onde estão

Tudo o que é design system vive na biblioteca, não aqui:

- Componentes: `UserInterface.Module/Libraries.layer/i-components.uilib/src/components/*`
- Tokens/temas/classes: `…/i-components.uilib/src/styles/*` (entrada: `styles/index.css`)
- Catálogo vivo das histórias: `ui-catalog.webgui` (Application Repository)
- Tipo de pacote `.uilib`: `repos/ecosystem-core-repository/docs/ui-libraries.md`

Neste painel sobra apenas:

- `src/Styles/control-panel.css` — CSS de produto, prefixo `.ecp-`, sobre os tokens.
