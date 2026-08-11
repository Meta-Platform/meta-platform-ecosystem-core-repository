// Superfície pública do kit comum. Todo aplicativo da plataforma monta interface
// a partir daqui (alias @i-components) — nenhum monta por conta própria.
//
// Até o APPUI-117 esta linha dizia "nunca de semantic-ui-react direto", porque o
// kit embrulhava o Semantic. Ele não embrulha mais: substituiu. Nem o kit pode
// importar Semantic hoje, e o lint falha se alguém tentar.
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
export * from "./components/advanced/runtime"
export * from "./components/advanced/authoring"
export * from "./catalog/types"
export { commonStories } from "./catalog/stories"
export * from "./theme"
export * from "./state"
