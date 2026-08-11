import * as React from "react"
import { useMemo, useRef, useState } from "react"

import Icon from "../Icon"
import MarkdownView from "./MarkdownView"

// Editor de markdown do design system.
//
// Deriva do `DescriptionEditor.tsx` do Meta Project Manager — mesma barra de
// ferramentas, mesmos três modos (editor / dividido / visualizar) e o mesmo
// caminho de imagem: File -> data-URI -> `![alt](data:…)`, que é como o MPM
// guarda imagem dentro da descrição de um item.
//
// DECISÃO: o kit NÃO adota `@uiw/react-md-editor`, que era a dependência do
// MPM. Um editor de terceiro traz a folha de estilo dele junto (e o
// `data-color-mode` próprio), o que devolveria para dentro do kit exatamente a
// matriz de estilo paralela que este projeto passou três fases removendo. O
// editor daqui é textarea + barra + preview pelo MarkdownView: um caminho de
// renderização só (sanitizado) e uma matriz de cor só (tokens --mp-*).

export type MarkdownEditorMode = "edit" | "split" | "preview"

const MODES: { key: MarkdownEditorMode, label: string, icon: string, hint: string }[] = [
    { key: "edit",    label: "Editor",     icon: "code",    hint: "Só o editor" },
    { key: "split",   label: "Dividido",   icon: "columns", hint: "Editor e visualização lado a lado" },
    { key: "preview", label: "Visualizar", icon: "eye",     hint: "Só a visualização" }
]

/* ------------------------------------------------------------------ */
/* Comandos da barra                                                  */
/* ------------------------------------------------------------------ */

// Um comando é uma transformação de seleção. Três formas cobrem tudo que a
// barra faz: envolver a seleção, prefixar cada linha ou inserir um bloco.
interface EditorCommand {
    key: string
    title: string
    icon?: string
    glyph?: React.ReactNode
    // envolve a seleção: ["**", "**"]
    wrap?: [ string, string ]
    // texto usado quando não há seleção
    sample?: string
    // prefixo aplicado a cada linha selecionada: "- ", "> ", "## "
    line?: string
    // bloco inserido inteiro no cursor
    insert?: string
    // abre o seletor de arquivo de imagem
    pick?: boolean
    divider?: boolean
}

const Glyph = (text: string, style: React.CSSProperties) =>
    <span style={{ fontSize: 13, lineHeight: 1, ...style }}>{text}</span>

const TABLE_SNIPPET = "\n| coluna | coluna |\n| --- | --- |\n| valor | valor |\n"

const COMMANDS: EditorCommand[] = [
    { key: "bold",      title: "Negrito (Ctrl+B)",    glyph: Glyph("B", { fontWeight: 800 }),                 wrap: [ "**", "**" ], sample: "texto" },
    { key: "italic",    title: "Itálico (Ctrl+I)",    glyph: Glyph("I", { fontStyle: "italic", fontWeight: 700 }), wrap: [ "*", "*" ], sample: "texto" },
    // Markdown não tem sublinhado: <u> é HTML, e o DOMPurify do MarkdownView
    // mantém a tag. Herdado do MPM, que precisa dela nas descrições.
    { key: "underline", title: "Sublinhado (Ctrl+U)", glyph: Glyph("U", { textDecoration: "underline", fontWeight: 700 }), wrap: [ "<u>", "</u>" ], sample: "texto" },
    { key: "strike",    title: "Tachado",             glyph: Glyph("S", { textDecoration: "line-through", fontWeight: 700 }), wrap: [ "~~", "~~" ], sample: "texto" },
    { key: "d1", title: "", divider: true },
    { key: "h2",     title: "Título",     glyph: Glyph("H2", { fontWeight: 800, fontSize: 11 }), line: "## " },
    { key: "h3",     title: "Subtítulo",  glyph: Glyph("H3", { fontWeight: 800, fontSize: 11 }), line: "### " },
    { key: "quote",  title: "Citação",    icon: "quote left", line: "> " },
    { key: "link",   title: "Link",       icon: "linkify", wrap: [ "[", "](https://)" ], sample: "texto" },
    { key: "d2", title: "", divider: true },
    { key: "code",      title: "Código em linha", icon: "code", wrap: [ "`", "`" ], sample: "código" },
    { key: "codeblock", title: "Bloco de código", icon: "file code outline", wrap: [ "```\n", "\n```" ], sample: "código" },
    { key: "d3", title: "", divider: true },
    { key: "ul",   title: "Lista",           icon: "list",    line: "- " },
    { key: "ol",   title: "Lista numerada",  icon: "list ol",  line: "1. " },
    { key: "task", title: "Lista de tarefas", icon: "check square outline", line: "- [ ] " },
    { key: "d4", title: "", divider: true },
    { key: "table", title: "Tabela",  icon: "table", insert: TABLE_SNIPPET },
    { key: "image", title: "Inserir imagem (ou cole/arraste no editor)", icon: "image", pick: true }
]

const SHORTCUT: { [key: string]: string } = { b: "bold", i: "italic", u: "underline" }

/* ------------------------------------------------------------------ */
/* Imagem embutida                                                    */
/* ------------------------------------------------------------------ */

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024

const FileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })

/* ------------------------------------------------------------------ */
/* Componente                                                         */
/* ------------------------------------------------------------------ */

export interface MarkdownEditorProps {
    value: string
    onChange: (markdown: string) => void
    // modo controlado; sem ele o editor guarda o modo internamente.
    mode?: MarkdownEditorMode
    onModeChange?: (mode: MarkdownEditorMode) => void
    defaultMode?: MarkdownEditorMode
    onBlur?: () => void
    placeholder?: string
    // rótulo do que está sendo editado ("descrição do item MPMB-12").
    label?: string
    // ações à direita da barra (Concluir, Cancelar…). O editor não decide
    // quando salvar: isso é do aplicativo.
    actions?: React.ReactNode
    height?: number | string
    toolbar?: boolean
    readOnly?: boolean
    autoFocus?: boolean
    // imagem colada/arrastada vira data-URI no próprio texto. Acima do limite,
    // o editor recusa e avisa — não trunca nem grava pela metade.
    maxImageBytes?: number
    onImageError?: (message: string) => void
    className?: string
}

export const MarkdownEditor = ({
    value, onChange, mode, onModeChange, defaultMode = "edit", onBlur,
    placeholder = "Escreva em markdown… (Ctrl+B negrito, Ctrl+I itálico, Ctrl+U sublinhado; cole ou arraste imagens)",
    label, actions, height = 380, toolbar = true, readOnly = false, autoFocus = false,
    maxImageBytes = DEFAULT_MAX_IMAGE_BYTES, onImageError, className = ""
}: MarkdownEditorProps) => {

    const [ ownMode, setOwnMode ] = useState<MarkdownEditorMode>(defaultMode)
    const [ imageError, setImageError ] = useState<string | undefined>(undefined)
    const textRef = useRef<HTMLTextAreaElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const current = mode !== undefined && onModeChange ? mode : ownMode
    const setMode = (next: MarkdownEditorMode) => {
        setOwnMode(next)
        if(onModeChange) onModeChange(next)
    }

    const text = value == null ? "" : String(value)

    // Toda escrita passa por aqui: aplica o texto novo e devolve o cursor para
    // onde o usuário espera encontrá-lo (dentro do que acabou de ser inserido).
    const apply = (next: string, selectionStart: number, selectionEnd: number) => {
        onChange(next)
        requestAnimationFrame(() => {
            const area = textRef.current
            if(!area) return
            area.focus()
            area.setSelectionRange(selectionStart, selectionEnd)
        })
    }

    const runCommand = (command: EditorCommand) => {
        if(readOnly) return
        if(command.pick){
            if(fileRef.current) fileRef.current.click()
            return
        }

        const area = textRef.current
        const start = area && area.selectionStart != null ? area.selectionStart : text.length
        const end = area && area.selectionEnd != null ? area.selectionEnd : start
        const selected = text.slice(start, end)

        if(command.wrap){
            const [ before, after ] = command.wrap
            const body = selected || command.sample || ""
            const next = text.slice(0, start) + before + body + after + text.slice(end)
            const from = start + before.length
            return apply(next, from, from + body.length)
        }

        if(command.line){
            // prefixa a linha inteira, mesmo com o cursor no meio dela.
            const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1
            const lineEnd = text.indexOf("\n", end) < 0 ? text.length : text.indexOf("\n", end)
            const block = text.slice(lineStart, lineEnd) || command.sample || ""
            const prefixed = block.split("\n").map((row) => command.line + row).join("\n")
            const next = text.slice(0, lineStart) + prefixed + text.slice(lineEnd)
            return apply(next, lineStart + prefixed.length, lineStart + prefixed.length)
        }

        if(command.insert){
            const next = text.slice(0, start) + command.insert + text.slice(end)
            const to = start + command.insert.length
            return apply(next, to, to)
        }
    }

    const insertAtCursor = (snippet: string) => {
        const area = textRef.current
        const start = area && area.selectionStart != null ? area.selectionStart : text.length
        const end = area && area.selectionEnd != null ? area.selectionEnd : start
        const next = text.slice(0, start) + snippet + text.slice(end)
        apply(next, start + snippet.length, start + snippet.length)
    }

    const failImage = (message: string) => {
        setImageError(message)
        if(onImageError) onImageError(message)
    }

    const insertImage = async (file: File) => {
        setImageError(undefined)
        if(!file.type || file.type.indexOf("image/") !== 0) return
        if(file.size > maxImageBytes)
            return failImage(`Imagem grande demais (${Math.round(file.size / 1024)} KB). Limite ${Math.round(maxImageBytes / 1024 / 1024)} MB.`)
        try {
            const uri = await FileToDataUri(file)
            const alt = (file.name || "imagem").replace(/\.[^.]+$/, "")
            insertAtCursor(`\n![${alt}](${uri})\n`)
        } catch(_) {
            failImage("Não foi possível ler a imagem.")
        }
    }

    const imagesOf = (list?: FileList | null) =>
        Array.prototype.slice.call(list || []).filter((file: File) => file.type && file.type.indexOf("image/") === 0)

    const onPaste = (event: React.ClipboardEvent) => {
        const images = imagesOf(event.clipboardData && event.clipboardData.files)
        if(!images.length) return
        event.preventDefault()
        images.forEach(insertImage)
    }

    const onDrop = (event: React.DragEvent) => {
        const images = imagesOf(event.dataTransfer && event.dataTransfer.files)
        if(!images.length) return
        event.preventDefault()
        images.forEach(insertImage)
    }

    const onDragOver = (event: React.DragEvent) => {
        const types = (event.dataTransfer && event.dataTransfer.types) || []
        if(Array.prototype.slice.call(types).indexOf("Files") >= 0) event.preventDefault()
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if(!(event.ctrlKey || event.metaKey)) return
        const key = SHORTCUT[event.key.toLowerCase()]
        if(!key) return
        const command = COMMANDS.filter((item) => item.key === key)[0]
        if(!command) return
        event.preventDefault()
        runCommand(command)
    }

    const style = { height: typeof height === "number" ? `${height}px` : height }
    const commands = useMemo(() => COMMANDS, [])

    return <div className={`mp-md-editor mp-md-editor--${current} ${className}`} style={style}>

        <div className="mp-md-editor__bar">
            { toolbar &&
                <div className="mp-md-editor__tools">
                    { commands.map((command) => command.divider
                        ? <span key={command.key} className="mp-md-editor__divider"/>
                        : <button
                            key={command.key}
                            type="button"
                            className="mp-md-editor__tool"
                            title={command.title}
                            aria-label={command.title}
                            disabled={readOnly}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => runCommand(command)}>
                            { command.icon ? <Icon name={command.icon}/> : command.glyph }
                        </button>) }
                </div> }

            <div className="mp-md-editor__modes">
                { MODES.map((item) =>
                    <button
                        key={item.key}
                        type="button"
                        title={item.hint}
                        className={`mp-md-editor__mode ${current === item.key ? "is-active" : ""}`}
                        onClick={() => setMode(item.key)}>
                        <Icon name={item.icon}/> {item.label}
                    </button>) }
            </div>

            { actions && <div className="mp-md-editor__actions">{actions}</div> }
        </div>

        { label && <div className="mp-md-editor__label">Editando {label}</div> }

        { imageError &&
            <div className="mp-md-editor__error" role="alert">
                <Icon name="warning sign"/> {imageError}
            </div> }

        <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(event) => {
                imagesOf(event.target.files).forEach(insertImage)
                event.target.value = ""
            }}/>

        <div className="mp-md-editor__body" onPaste={onPaste} onDrop={onDrop} onDragOver={onDragOver}>
            { current !== "preview" &&
                <textarea
                    ref={textRef}
                    className="mp-md-editor__text"
                    spellCheck={false}
                    autoFocus={autoFocus}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    value={text}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    onChange={(event) => onChange(event.target.value)}/> }

            { current !== "edit" &&
                <div className="mp-md-editor__preview">
                    <MarkdownView text={text} empty={<span className="mp-markdown__empty">Nada escrito ainda.</span>}/>
                </div> }
        </div>
    </div>
}

export default MarkdownEditor
