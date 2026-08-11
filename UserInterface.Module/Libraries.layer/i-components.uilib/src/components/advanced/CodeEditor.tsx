import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useTokenPalette } from "../../theme/palette"

// Editor de código do design system.
//
// Deriva do `CodeEditor.tsx` do Package Developer, que já resolvia a parte
// difícil sem dependência nenhuma: um <pre> colorido ATRÁS de um <textarea>
// transparente. O textarea recebe o caret e o input; o pre mostra as cores; o
// gutter e a banda da linha ativa acompanham o scroll.
//
// O que muda aqui é a COR. Lá, o realce era uma tabela literal copiada do VS
// Code (`#6a9955`, `#ce9178`, `#569cd6`), e a moldura usava uma família
// `--color-editor-*` própria do aplicativo — mais uma matriz de cor paralela.
// Aqui cada token do realce é uma variável CSS derivada de --mp-*, então o
// editor troca de cor junto com o tema, e o minimapa (que é canvas, e canvas
// não enxerga CSS) lê a mesma paleta por `useTokenPalette()`.

/* ------------------------------------------------------------------ */
/* Gramáticas                                                         */
/* ------------------------------------------------------------------ */

// Realce por expressão regular, de propósito. O objetivo é ler um arquivo de
// configuração ou um trecho de código — não substituir um LSP. A ordem das
// alternativas é o que faz funcionar: comentário e string vêm primeiro, senão
// uma palavra-chave dentro de uma string seria pintada.
type Rule = { token: string, pattern: string }

const JS_KEYWORDS = "const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|enum|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|yield|delete|void|require|module|public|private|protected|readonly|static"

const GRAMMARS: { [language: string]: Rule[] } = {
    javascript: [
        { token: "comment", pattern: "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/" },
        { token: "string",  pattern: "\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`" },
        { token: "number",  pattern: "\\b\\d[\\d._]*(?:\\.\\d+)?\\b" },
        { token: "keyword", pattern: `\\b(?:${JS_KEYWORDS})\\b` },
        { token: "literal", pattern: "\\b(?:true|false|null|undefined|NaN|Infinity)\\b" }
    ],
    json: [
        { token: "string",  pattern: "\"(?:[^\"\\\\]|\\\\.)*\"" },
        { token: "number",  pattern: "-?\\b\\d[\\d.eE+-]*\\b" },
        { token: "literal", pattern: "\\b(?:true|false|null)\\b" }
    ],
    css: [
        { token: "comment", pattern: "\\/\\*[\\s\\S]*?\\*\\/" },
        { token: "string",  pattern: "\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'" },
        { token: "keyword", pattern: "@[a-zA-Z-]+" },
        { token: "literal", pattern: "--[a-zA-Z0-9-]+" },
        { token: "number",  pattern: "#[0-9a-fA-F]{3,8}\\b|\\b\\d[\\d.]*(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\\b" }
    ],
    xml: [
        { token: "comment", pattern: "<!--[\\s\\S]*?-->" },
        { token: "string",  pattern: "\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'" },
        { token: "keyword", pattern: "<\\/?[a-zA-Z][\\w:.-]*|\\/?>" },
        { token: "literal", pattern: "[a-zA-Z-][\\w:.-]*(?=\\s*=)" }
    ],
    shell: [
        { token: "comment", pattern: "#[^\\n]*" },
        { token: "string",  pattern: "\"(?:[^\"\\\\]|\\\\.)*\"|'[^']*'" },
        { token: "keyword", pattern: "\\b(?:if|then|else|fi|for|in|do|done|while|case|esac|function|export|return|local|source)\\b" },
        { token: "number",  pattern: "\\b\\d+\\b" },
        { token: "literal", pattern: "\\$\\{?[A-Za-z_][A-Za-z0-9_]*\\}?" }
    ]
}

// Nome de linguagem -> gramática. Nomes desconhecidos caem em texto puro, que é
// melhor do que pintar errado com confiança.
const LANGUAGE_ALIAS: { [name: string]: string } = {
    js: "javascript", jsx: "javascript", javascript: "javascript",
    ts: "javascript", tsx: "javascript", typescript: "javascript",
    json: "json", jsonc: "json",
    css: "css", scss: "css", less: "css",
    xml: "xml", html: "xml", svg: "xml",
    sh: "shell", bash: "shell", shell: "shell", ini: "shell", yaml: "shell", yml: "shell", env: "shell"
}

// Extensão de arquivo -> linguagem. Vem do `getLanguage` do modal do Package
// Developer; mora aqui para o aplicativo não precisar de uma cópia.
export const GuessLanguage = (filename: string): string => {
    const name = String(filename || "")
    const special: { [file: string]: string } = {
        ".eslintrc": "json", ".babelrc": "json", ".editorconfig": "ini", ".env": "ini",
        "Dockerfile": "shell", "Makefile": "shell"
    }
    const base = name.split("/").pop() || name
    if(special[base]) return special[base]
    const parts = base.split(".")
    const extension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
    const known: { [ext: string]: string } = {
        js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
        ts: "typescript", tsx: "typescript",
        json: "json", css: "css", scss: "scss", less: "less",
        html: "html", xml: "xml", svg: "xml",
        sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml", ini: "ini", md: "markdown"
    }
    return known[extension] || "plaintext"
}

const EscapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const RegexCache: { [language: string]: RegExp | null } = {}

const RegexOf = (language: string): RegExp | null => {
    const grammar = GRAMMARS[LANGUAGE_ALIAS[String(language || "").toLowerCase()] || ""]
    if(!grammar) return null
    const key = LANGUAGE_ALIAS[String(language).toLowerCase()]
    if(RegexCache[key] !== undefined) return RegexCache[key]
    RegexCache[key] = new RegExp(grammar.map((rule) => `(${rule.pattern})`).join("|"), "g")
    return RegexCache[key]
}

// Código -> HTML com <span class="mp-code-editor__tok mp-code-editor__tok--X">.
// A COR de cada classe vive no CSS (var(--mp-code-*)), então trocar o tema
// repinta o realce sem passar por aqui.
export const HighlightCode = (code: string, language: string): string => {
    const key = LANGUAGE_ALIAS[String(language || "").toLowerCase()]
    const grammar = GRAMMARS[key]
    const regex = RegexOf(language)
    if(!grammar || !regex) return EscapeHtml(code)

    let out = "", last = 0, match: RegExpExecArray | null
    regex.lastIndex = 0
    while((match = regex.exec(code)) !== null){
        if(match[0] === ""){ regex.lastIndex++; continue }
        out += EscapeHtml(code.slice(last, match.index))
        let token = grammar[grammar.length - 1].token
        for(let index = 0; index < grammar.length; index++)
            if(match[index + 1] !== undefined){ token = grammar[index].token; break }
        out += `<span class="mp-code-editor__tok mp-code-editor__tok--${token}">${EscapeHtml(match[0])}</span>`
        last = match.index + match[0].length
    }
    return out + EscapeHtml(code.slice(last))
}

/* ------------------------------------------------------------------ */
/* Componente                                                         */
/* ------------------------------------------------------------------ */

// Casados com --mp-code-line-h / --mp-code-pad-y em advanced-authoring.css: o
// gutter, a banda da linha ativa e o minimapa são posicionados em JS, e todos
// precisam da MESMA altura de linha do <pre>.
const LINE_H = 20
const PAD_Y = 12

export type CodeEditorSurface = "paper" | "terminal"

export interface CodeEditorProps {
    value: string
    onChange?: (value: string) => void
    // "javascript" | "typescript" | "json" | "css" | "xml" | "shell" | …
    // Use GuessLanguage(filename) quando só houver o nome do arquivo.
    language?: string
    // "paper" acompanha a superfície da página (padrão); "terminal" pinta com a
    // família --mp-terminal-*, para editor embutido em contexto de console.
    surface?: CodeEditorSurface
    readOnly?: boolean
    // rola até a linha; `n` muda a cada pedido para reagir a pedidos repetidos
    // da MESMA linha.
    scrollTo?: { line: number, n: number }
    gutter?: boolean
    minimap?: boolean
    height?: number | string
    className?: string
    ariaLabel?: string
}

export const CodeEditor = ({
    value, onChange, language = "plaintext", surface = "paper", readOnly = false,
    scrollTo, gutter = true, minimap = true, height = 420, className = "", ariaLabel = "Editor de código"
}: CodeEditorProps) => {

    const code = value == null ? "" : String(value)
    const palette = useTokenPalette()

    const preRef = useRef<HTMLPreElement>(null)
    const areaRef = useRef<HTMLTextAreaElement>(null)
    const gutterRef = useRef<HTMLDivElement>(null)
    const bandRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const viewportRef = useRef<HTMLDivElement>(null)

    const [ activeLine, setActiveLine ] = useState(1)
    const activeLineRef = useRef(1)
    activeLineRef.current = activeLine

    const lineCount = (code.match(/\n/g) || []).length + 1
    const html = useMemo(() => HighlightCode(code, language) + "\n", [ code, language ])

    const positionBand = () => {
        const area = areaRef.current, band = bandRef.current
        if(area && band)
            band.style.transform = `translateY(${PAD_Y + (activeLineRef.current - 1) * LINE_H - area.scrollTop}px)`
    }

    /* ---- minimapa (canvas: precisa de cor em JS, daí a paleta) ---- */

    const miniLineHeight = () => {
        const canvas = canvasRef.current
        if(!canvas) return 3
        return Math.min(4, canvas.clientHeight / lineCount)
    }

    const drawMinimap = () => {
        const canvas = canvasRef.current
        if(!canvas) return
        const width = canvas.width = canvas.clientWidth || 60
        const heightPx = canvas.height = canvas.clientHeight || 300
        const context = canvas.getContext("2d")
        if(!context) return
        context.clearRect(0, 0, width, heightPx)
        context.fillStyle = surface === "terminal" ? palette.terminal.muted : palette.muted
        context.globalAlpha = 0.55
        const lines = code.split("\n")
        const lineHeight = miniLineHeight()
        for(let index = 0; index < lines.length; index++){
            const row = lines[index].replace(/\s+$/, "")
            const indent = (row.match(/^\s*/) || [ "" ])[0].length
            const length = Math.min(row.length, 90)
            if(length > indent)
                context.fillRect(2 + indent * 0.7, index * lineHeight, (length - indent) * 0.7, Math.max(1, lineHeight - 0.6))
        }
        context.globalAlpha = 1
    }

    const updateViewport = () => {
        const area = areaRef.current, viewport = viewportRef.current
        if(!area || !viewport) return
        const lineHeight = miniLineHeight()
        viewport.style.top = `${(area.scrollTop / LINE_H) * lineHeight}px`
        viewport.style.height = `${Math.max(14, (area.clientHeight / LINE_H) * lineHeight)}px`
    }

    const syncScroll = () => {
        const area = areaRef.current
        if(!area) return
        if(preRef.current){
            preRef.current.scrollTop = area.scrollTop
            preRef.current.scrollLeft = area.scrollLeft
        }
        if(gutterRef.current) gutterRef.current.scrollTop = area.scrollTop
        positionBand()
        updateViewport()
    }

    // A paleta entra na dependência: trocar de tema tem de redesenhar o canvas.
    useEffect(() => { drawMinimap(); updateViewport() }, [ code, palette, surface ])

    useEffect(() => {
        const redraw = () => { drawMinimap(); updateViewport() }
        window.addEventListener("resize", redraw)
        const timer = setTimeout(redraw, 50)
        return () => { window.removeEventListener("resize", redraw); clearTimeout(timer) }
    }, [])

    useEffect(() => {
        if(!scrollTo || !scrollTo.line) return
        requestAnimationFrame(() => {
            const area = areaRef.current
            if(!area) return
            area.scrollTop = Math.max(0, (scrollTo.line - 1) * LINE_H - area.clientHeight / 2)
            setActiveLine(scrollTo.line)
            activeLineRef.current = scrollTo.line
            syncScroll()
        })
    }, [ scrollTo && scrollTo.n ])

    const updateCaret = () => {
        const area = areaRef.current
        if(!area) return
        const line = code.substring(0, area.selectionStart).split("\n").length
        setActiveLine(line)
        activeLineRef.current = line
        positionBand()
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if(event.key !== "Tab" || readOnly || !onChange) return
        event.preventDefault()
        const target = event.target as HTMLTextAreaElement
        const start = target.selectionStart, end = target.selectionEnd
        onChange(code.substring(0, start) + "    " + code.substring(end))
        requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 4 })
    }

    const onMinimapClick = (event: React.MouseEvent) => {
        const canvas = canvasRef.current, area = areaRef.current
        if(!canvas || !area) return
        const y = event.clientY - canvas.getBoundingClientRect().top
        area.scrollTop = Math.max(0, (y / miniLineHeight()) * LINE_H - area.clientHeight / 2)
        syncScroll()
    }

    const numbers = []
    for(let line = 1; line <= lineCount; line++)
        numbers.push(<div key={line} className={`mp-code-editor__line ${line === activeLine ? "is-active" : ""}`}>{line}</div>)

    const style = { height: typeof height === "number" ? `${height}px` : height }

    return <div className={`mp-code-editor mp-code-editor--${surface} ${className}`} style={style}>

        { gutter &&
            <div ref={gutterRef} className="mp-code-editor__gutter" aria-hidden="true">
                <div>{numbers}</div>
            </div> }

        <div className="mp-code-editor__area">
            <div ref={bandRef} className="mp-code-editor__band" aria-hidden="true"
                style={{ transform: `translateY(${PAD_Y}px)` }}/>
            <pre ref={preRef} className="mp-code-editor__pre" aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: html }}/>
            <textarea
                ref={areaRef}
                className="mp-code-editor__text"
                aria-label={ariaLabel}
                spellCheck={false}
                readOnly={readOnly || !onChange}
                value={code}
                onChange={(event) => {
                    if(onChange) onChange(event.target.value)
                    requestAnimationFrame(updateCaret)
                }}
                onScroll={syncScroll}
                onKeyDown={onKeyDown}
                onKeyUp={updateCaret}
                onClick={updateCaret}/>
        </div>

        { minimap &&
            <div className="mp-code-editor__minimap" title="Minimapa — clique para navegar" onClick={onMinimapClick}>
                <canvas ref={canvasRef}/>
                <div ref={viewportRef} className="mp-code-editor__viewport"/>
            </div> }
    </div>
}

export default CodeEditor
