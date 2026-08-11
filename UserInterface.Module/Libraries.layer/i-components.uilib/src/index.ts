// Superfície pública do kit comum. Todo aplicativo da plataforma monta interface
// a partir daqui (alias @i-components) — nenhum monta por conta própria.
//
// Até o APPUI-117 esta linha dizia "nunca de semantic-ui-react direto", porque o
// kit embrulhava o Semantic. Ele não embrulha mais: substituiu. Nem o kit pode
// importar Semantic hoje, e o lint falha se alguém tentar.
//
// ---------------------------------------------------------------------------
// REGRA DESTE ARQUIVO: nada aqui pode importar dependência pesada.
// ---------------------------------------------------------------------------
// Os 7 componentes pesados (Terminal, TimeSeriesChart, LogViewer, DiagramCanvas,
// MarkdownView, MarkdownEditor, CodeEditor) e as histórias do catálogo NÃO são
// reexportados daqui. Vêm por subcaminho, que o alias `@i-components/*` já
// resolve:
//
//   import { Terminal, LogViewer } from "@i-components/components/advanced/runtime"
//   import { MarkdownView }       from "@i-components/components/advanced/authoring"
//   import { commonStories }      from "@i-components/catalog/stories"
//
// Foram reexportados aqui por um tempo, e custou duas coisas de uma vez:
//
//   1. QUEBROU O JEST de quem importasse `@i-components`. A cadeia
//      `index.ts -> advanced/runtime -> TimeSeriesChart -> d3` fazia o jest
//      carregar o d3, que é ESM puro, e a suíte morria com
//      `SyntaxError: Unexpected token 'export'`. Eram 7 de 12 suítes do
//      package-developer e 3 do MPM, em arquivos que ninguém tinha tocado.
//   2. ENGORDOU O BUNDLE de quem não usa nenhum deles: um aplicativo que só
//      quer um botão pagava por xterm, d3, reactflow e dagre.
//
// `commonStories` sai pelo mesmo motivo: ele importa as histórias dos pesados,
// então mantê-lo aqui recriaria a cadeia inteira por outro caminho.
export * from "./components/Primitives"
export { default as Icon } from "./components/Icon"
export type { IconTone } from "./components/Icon"
export * from "./components/Controls"
export * from "./components/Inputs"
export * from "./components/Feedback"
export * from "./components/Overlays"
export * from "./components/DataDisplay"
export * from "./components/Headers"
export * from "./components/Shell"
export { default as StatusBadge, GetStatusMeta, GetStatusTone, GetStatusIcon, GetSeverityRank } from "./components/StatusBadge"
export type { StatusTone } from "./components/StatusBadge"
export { default as CopyableMonoText, TruncateMiddle } from "./components/CopyableMonoText"
export { default as ThemePicker, BuildThemeMenuItems } from "./components/ThemePicker"
export type { ThemePickerProps, ThemePickerVariant } from "./components/ThemePicker"
export * from "./catalog/types"
export * from "./theme"
export * from "./state"

// A camada de transporte (`@i-components/net`) também NÃO é reexportada aqui,
// pela mesma regra e pelo mesmo sintoma: ela importa `query-string`, que é ESM
// puro, e o jest morria com `Cannot use import statement outside a module` em
// qualquer teste que tocasse `@i-components` — mesmo num teste de botão.
//
//   import { GetRequestByServer } from "@i-components/net"
