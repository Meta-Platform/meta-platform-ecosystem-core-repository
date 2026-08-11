// Componentes pesados de AUTORIA e de representação: DiagramCanvas (reactflow +
// dagre), MarkdownView (marked + dompurify), MarkdownEditor e CodeEditor.
//
// Ver o comentário de `runtime.ts` sobre por que o barril é separado.

export { DiagramCanvas, LayoutDiagram } from "./DiagramCanvas"
export type {
    DiagramCanvasProps, DiagramNodeInput, DiagramEdgeInput, DiagramEdgeKind, DiagramDirection
} from "./DiagramCanvas"

export { MarkdownView, RenderMarkdown } from "./MarkdownView"
export type { MarkdownViewProps, RenderMarkdownOptions } from "./MarkdownView"

export { MarkdownEditor } from "./MarkdownEditor"
export type { MarkdownEditorProps, MarkdownEditorMode } from "./MarkdownEditor"

export { CodeEditor, GuessLanguage, HighlightCode } from "./CodeEditor"
export type { CodeEditorProps, CodeEditorSurface } from "./CodeEditor"
