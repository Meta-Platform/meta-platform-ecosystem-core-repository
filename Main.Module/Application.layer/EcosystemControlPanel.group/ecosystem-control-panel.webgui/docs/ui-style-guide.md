# Meta System Retro-Brutalist UI — Style Guide

Guia de reuso do design system para **todos os painéis** da Meta Platform (ex.:
`ecosystem-control-panel.webgui`, `virtual-desk.webgui`, `repository-manager-panel.webgui`).
O objetivo é que qualquer painel novo pareça parte da mesma família sem reinventar
tokens, shell ou componentes.

> Estilo oficial: **Meta System Retro-Brutalist UI** — desktop técnico retrô:
> superfícies em papel/off-white, bordas escuras, grid sutil, tipografia forte,
> sombras duras, acentos de estado, componentes que parecem objetos de sistema.

## 1. Estrutura de estilos (import nesta ordem)

```ts
import "semantic-ui-css/semantic.css"      // base (quando o painel usa Semantic)
import "./Styles/tokens.css"               // tokens --mp-* (fonte única de verdade)
import "./Styles/theme-retro-brutalist.css"// overlay: reaponta --eco-*→--mp-*, overrides Semantic
import "./Styles/components.css"            // classes .mp-* dos componentes
```

- **tokens.css** — só `:root` com tokens `--mp-*` (cores paper/ink/lines/accents/
  status/terminal, tipografia, espaçamento, radius, bordas, sombras duras, z-index).
  Reaproveitável por qualquer painel sem arrastar estilo específico.
- **theme-retro-brutalist.css** — fundo papel+grid, overrides do Semantic UI
  (botões táteis, ledger tables, badges, modais como janelas), e a ponte
  `--eco-*` → `--mp-*` (compat. com a base legada).
- **components.css** — classes `.mp-*` (masthead, status strip, object card,
  entity header, tiles, banners, copyable).

**Regra:** nada de cor/borda/sombra hardcoded em telas. Sempre `var(--mp-*)`.
Escala de bordas: `--mp-border-thin` (1px) para componentes internos;
`--mp-border`/`--mp-border-strong` (2px) para superfícies estruturais.

## 2. Componentes primitivos (`src/Components/ui/`)

| Componente | Uso |
|---|---|
| `PageMasthead` | Cabeçalho de página: ícone + título + subtítulo + ações + faixa de contexto. **Toda tela principal começa com ele.** |
| `StatusStrip` + `StatusChip` | Faixa de contadores/filtros. Chip estático (contador) ou clicável (filtro) com `active`. Tons: neutral/success/warning/danger/info. |
| `ObjectCard` | Card canônico de entidade (executável, pacote, repo…). Slots: ícone \| título+status / meta(mono) / chips+ação. Título **ink**, não azul. |
| `EntityHeader` | Cabeçalho de detalhe de entidade: `iconNode`, título, `typeLabel`, `status` (StatusBadge), `badges`, `meta`, `technicalRef` (copiável), `actions`. |
| `CopyableMonoText` | Dado técnico (path/hash/socket) mono, truncamento central (`maxChars`), botão copiar. |
| `SystemBanner` | Faixa read-only/aviso. Tons: info/readonly/warning/danger/success. Ícone+título+texto (nunca só cor). |

Reaproveitados de `src/Components/`: `StatusBadge` (registro de status↔cor↔ícone),
`CopyValue`, `EmptyState`.

## 3. Shell compartilhado

- **TopBar** (`MainMenu`): barra de sistema (borda inferior forte), logo, breadcrumb
  da seção ativa, chip do workspace path, notificações.
- **SidebarNav** (`EcosystemNavigator`): árvore paper-2, busca fixa, item ativo com
  faixa lateral + tint, contadores à direita.
- **RuntimeDock** (`LogDock`): dock escuro (`--mp-terminal-bg-2`), faixa superior por
  estado de conexão (verde/atenção/erro), abas de stream; janelas de terminal com
  titlebar por tipo (exec=laranja, runtime=azul) e corpo `--mp-terminal-bg`.
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

- [ ] Importa `tokens.css` + `theme-retro-brutalist.css` + `components.css`.
- [ ] Nenhuma cor/borda/sombra hardcoded (tudo `var(--mp-*)`).
- [ ] Telas de lista usam `PageMasthead` + `StatusStrip`.
- [ ] Cards usam `ObjectCard`; detalhes usam `EntityHeader`.
- [ ] Paths/hashes usam `CopyableMonoText`.
- [ ] Avisos/read-only usam `SystemBanner`.
- [ ] Status sempre texto+ícone+cor (via `StatusBadge`).
- [ ] Botões: variantes semânticas (primary/secondary/basic); `basic` colorido = outline.
- [ ] Terminais/logs usam os tokens `--mp-terminal-*`.
- [ ] Funciona em 1288×832 sem scroll horizontal.

## 7. Onde estão (neste painel)

- Tokens: `src/Styles/tokens.css`
- Tema/overrides: `src/Styles/theme-retro-brutalist.css`
- Componentes: `src/Styles/components.css` + `src/Components/ui/*`
