// Paleta do design system exposta como VALORES JS.
//
// Existe porque há uma família de componentes que não pinta por CSS: reactflow,
// d3 e xterm recebem cor por prop/opção JavaScript. Sem esta ponte, cada
// aplicativo acabava escrevendo a própria tabela de cores em hexadecimal — foi
// exatamente o que aconteceu em `DiagramTheme.ts` (control panel) e
// `diagramTheme.ts` (package developer): duas tabelas com cores que não existem
// em token nenhum e que, por isso, ignoram o tema.
//
// A regra aqui é a mesma do CSS: nada de cor literal. Tudo sai de `--mp-*`
// lido do documento, então trocar de tema muda o diagrama junto.

import { useEffect, useMemo, useState } from "react"

// ---------------------------------------------------------------------------
// Leitura de token
// ---------------------------------------------------------------------------

// A reserva NÃO é uma segunda fonte de verdade: só evita `""` em ambiente sem
// DOM (teste, SSR). Um token que não existe é bug de CSS, e o valor de reserva
// é escolhido para ser visível — nunca transparente — para o bug aparecer.
export const ReadToken = (name:string, fallback = "#000000"):string => {
    if(typeof document === "undefined") return fallback
    const value = getComputedStyle(document.documentElement).getPropertyValue(name)
    return value.trim() || fallback
}

// O tema é um atributo `data-theme` no <html> (ver theme/index.ts). Quem pinta
// em JS precisa re-ler os tokens quando ele muda — o CSS faz isso sozinho, o
// canvas não.
export const useThemeVersion = ():number => {
    const [version, setVersion] = useState(0)
    useEffect(() => {
        if(typeof document === "undefined") return
        const observer = new MutationObserver(() => setVersion((v) => v + 1))
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
        return () => observer.disconnect()
    }, [])
    return version
}

// ---------------------------------------------------------------------------
// Paleta base
// ---------------------------------------------------------------------------

export interface TokenPalette {
    ink:        string
    inkSoft:    string
    muted:      string
    surface:    string
    surface2:   string
    paper:      string
    line:       string
    lineSoft:   string
    lineStrong: string
    grid:       string
    accents: {
        blue:   string
        cyan:   string
        orange: string
        yellow: string
        pink:   string
        violet: string
    }
    states: {
        success: string
        warning: string
        danger:  string
        info:    string
        neutral: string
    }
    terminal: {
        bg:     string
        bg2:    string
        fg:     string
        muted:  string
        green:  string
        orange: string
        red:    string
        blue:   string
    }
    fontMono: string
    fontUi:   string
}

export const ReadTokenPalette = ():TokenPalette => ({
    ink:        ReadToken("--mp-ink", "#171713"),
    inkSoft:    ReadToken("--mp-ink-3", "#3E413B"),
    muted:      ReadToken("--mp-muted", "#73766D"),
    surface:    ReadToken("--mp-surface", "#FFF9E8"),
    surface2:   ReadToken("--mp-surface-2", "#F8F1DD"),
    paper:      ReadToken("--mp-paper", "#F6F0DE"),
    line:       ReadToken("--mp-line", "#32342F"),
    lineSoft:   ReadToken("--mp-line-soft", "#B8B3A3"),
    lineStrong: ReadToken("--mp-line-strong", "#171713"),
    grid:       ReadToken("--mp-line-faint", "#D7CFBA"),
    accents: {
        blue:   ReadToken("--mp-accent-blue", "#2D74C4"),
        cyan:   ReadToken("--mp-accent-cyan", "#00B7C2"),
        orange: ReadToken("--mp-accent-orange", "#C96A1E"),
        yellow: ReadToken("--mp-accent-yellow", "#F2C230"),
        pink:   ReadToken("--mp-accent-pink", "#E96AB6"),
        violet: ReadToken("--mp-accent-violet", "#8E73D8")
    },
    states: {
        success: ReadToken("--mp-success", "#1FAD57"),
        warning: ReadToken("--mp-warning", "#E8A300"),
        danger:  ReadToken("--mp-danger", "#E34949"),
        info:    ReadToken("--mp-info", "#2D74C4"),
        neutral: ReadToken("--mp-neutral", "#7B7F76")
    },
    terminal: {
        bg:     ReadToken("--mp-terminal-bg", "#0B1020"),
        bg2:    ReadToken("--mp-terminal-bg-2", "#10182B"),
        fg:     ReadToken("--mp-terminal-fg", "#F6F0DE"),
        muted:  ReadToken("--mp-terminal-muted", "#91A0B8"),
        green:  ReadToken("--mp-terminal-green", "#4DFF88"),
        orange: ReadToken("--mp-terminal-orange", "#FF9B29"),
        red:    ReadToken("--mp-terminal-red", "#FF6B6B"),
        blue:   ReadToken("--mp-terminal-blue", "#6DB7FF")
    },
    fontMono: ReadToken("--mp-font-mono", "monospace"),
    fontUi:   ReadToken("--mp-font-ui", "system-ui, sans-serif")
})

export const useTokenPalette = ():TokenPalette => {
    const version = useThemeVersion()
    return useMemo(() => ReadTokenPalette(), [version])
}

// ---------------------------------------------------------------------------
// Diagramas
// ---------------------------------------------------------------------------

// Um nó é superfície plana + borda de acento forte + texto tinta. Não há tinta
// pastel de fundo por tipo: o pastel só existiria como constante hexadecimal
// (não há token de tint por acento), e seria justamente a cor que não segue o
// tema. A cor do TIPO vive na borda, que é o eixo do neobrutalismo.
export type DiagramKind =
    "webapp" | "webservice" | "webgui" | "desktopapp" |
    "app" | "cli" | "service" | "lib" | "uilib" | "taskloader" | "other"

export interface DiagramNodeStyle {
    background: string
    border:     string
    label:      string
    color:      string
}

const KIND_LABEL:Record<DiagramKind, string> = {
    webapp     : "Web App",
    webservice : "Web Service",
    webgui     : "Web GUI",
    desktopapp : "Desktop App",
    app        : "App",
    cli        : "CLI",
    service    : "Service",
    lib        : "Biblioteca",
    uilib      : "Biblioteca de UI",
    taskloader : "Task Loader",
    other      : "Outros"
}

const KindAccent = (palette:TokenPalette):Record<DiagramKind, string> => ({
    webapp     : palette.accents.blue,
    webservice : palette.states.success,
    webgui     : palette.accents.violet,
    desktopapp : palette.accents.cyan,
    app        : palette.accents.cyan,
    cli        : palette.states.neutral,
    service    : palette.accents.yellow,
    lib        : palette.accents.pink,
    uilib      : palette.accents.violet,
    taskloader : palette.accents.orange,
    other      : palette.lineSoft
})

export interface DiagramPalette {
    node:       (kind:DiagramKind) => DiagramNodeStyle
    kindOf:     (namespace:string) => DiagramKind
    labelOf:    (kind:DiagramKind) => string
    edge:       { child:string, dependency:string, highlight:string }
    background: string
    grid:       string
    text:       string
    textMuted:  string
    fontUi:     string
    fontMono:   string
}

// "@/api-designer.webservice" -> "webservice"; "/api-designer" -> "other".
export const KindOfNamespace = (namespace:string):DiagramKind => {
    if(typeof namespace !== "string") return "other"
    const match = namespace.match(/\.([a-zA-Z]+)$/)
    if(!match) return "other"
    const kind = match[1].toLowerCase() as DiagramKind
    return KIND_LABEL[kind] ? kind : "other"
}

export const BuildDiagramPalette = (palette:TokenPalette):DiagramPalette => {
    const accent = KindAccent(palette)
    return {
        node: (kind:DiagramKind) => ({
            background : palette.surface,
            border     : accent[kind] || accent.other,
            label      : KIND_LABEL[kind] || KIND_LABEL.other,
            color      : palette.ink
        }),
        kindOf     : KindOfNamespace,
        labelOf    : (kind:DiagramKind) => KIND_LABEL[kind] || KIND_LABEL.other,
        edge       : {
            child      : palette.lineSoft,
            dependency : palette.accents.violet,
            highlight  : palette.accents.orange
        },
        background : palette.paper,
        grid       : palette.grid,
        text       : palette.ink,
        textMuted  : palette.muted,
        fontUi     : palette.fontUi,
        fontMono   : palette.fontMono
    }
}

export const useDiagramPalette = ():DiagramPalette => {
    const palette = useTokenPalette()
    return useMemo(() => BuildDiagramPalette(palette), [palette])
}
