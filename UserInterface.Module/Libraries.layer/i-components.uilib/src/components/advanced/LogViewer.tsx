import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button, Toolbar } from "../Controls"
import { SearchInput } from "../Inputs"
import { StatusChip } from "../Headers"

// Visor de log do kit.
//
// De onde veio: das DUAS implementações que existiam, que não eram a mesma
// coisa nem por acidente.
//
//   - Instance Executor Control Panel (`system/LogViewer.tsx`) — log de uma
//     instância viva: linhas de texto cru chegando por WebSocket, teto de
//     memória com descarte pela frente, acompanhar/travar ao rolar, quebra de
//     linha, filtro por texto, copiar. Realce de nível por palpite (regex sobre
//     a linha), porque a linha não vem estruturada.
//   - Ecosystem Control Panel (`Logs.container/LogViewer.tsx`) — leitura de um
//     arquivo JSONL: registros estruturados (ts, level, source, message, data),
//     filtro por nível como conjunto, filtro por origem. Não corta nada em
//     memória e não trava o autoscroll.
//
// O kit atende os dois: `entries` (estruturado) e `lines` (texto cru, que é
// normalizado para entries com só `message`). Quem tem estrutura ganha filtro
// exato por nível; quem não tem ganha o palpite.
//
// O que este componente acrescenta às duas origens:
//   - VIRTUALIZAÇÃO: só as linhas visíveis existem no DOM. Quatro mil <div> de
//     log travavam a rolagem do painel — e é justamente numa investigação de
//     falha que o painel não pode travar.
//   - ANSI colorido, sem dependência nova. O primeiro visor apagava as
//     sequências com expressão regular e perdia a informação; o outro nem
//     tratava. Aqui há um interpretador de SGR de 60 linhas que traduz a cor do
//     stream para os tokens --mp-terminal-*. Foi decisão de desenho não usar
//     `ansi-to-html`: aquela biblioteca emite hexadecimal literal na marcação,
//     que é exatamente a cor que não segue o tema.

export type LogEntry = {
    id?      : string | number
    // Milissegundos, ISO 8601 ou já formatado — é exibido como veio.
    ts?      : string | number
    level?   : string
    source?  : string
    message  : string
    // Objeto anexo do log estruturado (o `data` do JSONL da plataforma).
    data?    : any
    // Linha sem estrutura, vinda do stdout de um processo.
    raw?     : boolean
}

export type LogViewerProps = {
    entries?      : LogEntry[]
    // Atalho para log de texto cru: cada string vira uma entrada.
    lines?        : string[]
    height?       : number | string
    // Teto de linhas em memória. O corte é pela FRENTE, que é o lado velho.
    maxLines?     : number
    levels?       : string[]
    defaultLevels?: string[]
    defaultFollow?: boolean
    defaultWrap?  : boolean
    // "render" pinta as cores do stream; "strip" apaga as sequências; "raw"
    // deixa aparecer (útil para depurar o próprio emissor).
    ansi?         : "render" | "strip" | "raw"
    showToolbar?  : boolean
    showLineNumbers? : boolean
    showLevelFilter? : boolean
    // Altura de uma linha, em pixels. É o que torna a virtualização possível —
    // e por isso a quebra de linha a desliga (linha quebrada não tem altura fixa).
    rowHeight?    : number
    emptyLabel?   : string
    // Conteúdo livre à direita da barra: o estado da conexão, o tamanho do
    // arquivo, o seletor de arquivo do dia. É a fronteira do kit — ele não sabe
    // de onde o log vem.
    toolbarExtra? : React.ReactNode
    meta?         : React.ReactNode
    className?    : string
    onFilterChange? : (filter:string) => void
    onLevelsChange? : (levels:string[]) => void
    onFollowChange? : (follow:boolean) => void
    // Pedido de limpeza. Sem ele o botão apaga só o que está na tela; com ele,
    // quem é dono do buffer decide.
    onClear?      : () => void
}

export const LOG_LEVELS = [ "trace", "debug", "info", "message", "warn", "error", "fatal" ]

const LEVEL_TONE:Record<string, string> = {
    trace   : "neutral",
    debug   : "neutral",
    info    : "info",
    message : "success",
    warn    : "warning",
    error   : "danger",
    fatal   : "danger"
}

// Quando a linha não é estruturada, o nível é um palpite. Vale a pena: sem ele
// um erro no meio de mil linhas é invisível.
const LEVEL_GUESS = [
    { level: "error", pattern: /\b(error|erro|exception|fatal|failed|falha)\b/i },
    { level: "warn",  pattern: /\b(warn|warning|aviso|deprecated)\b/i }
]

const GuessLevel = (message:string):string | undefined => {
    const found = LEVEL_GUESS.find((entry) => entry.pattern.test(message))
    return found ? found.level : undefined
}

/* ------------------------------------------------------------------ */
/* ANSI                                                               */
/* ------------------------------------------------------------------ */

// Só as sequências CSI ... m (SGR) mudam aparência; as outras movem o cursor e
// não têm sentido numa lista de linhas, então são descartadas. O ESC faz parte
// do padrão de propósito: sem ele, "[info]" e "[daemon]" seriam comidos junto
// com as cores.
const ANSI_PATTERN = /\u001B\[([0-9;]*)([A-Za-z])/g

export type AnsiSegment = {
    text        : string
    color?      : string
    background? : string
    bold?       : boolean
    dim?        : boolean
    underline?  : boolean
}

export const StripAnsi = (text:string):string => text.replace(ANSI_PATTERN, "")

// Índice da paleta ANSI (0-15) → token. É o mesmo mapa do Terminal do kit:
// nenhuma cor nasce aqui.
const AnsiPaletteKey = (index:number):string => [
    "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
    "brightBlack", "brightRed", "brightGreen", "brightYellow",
    "brightBlue", "brightMagenta", "brightCyan", "brightWhite"
][index] || "white"

const ANSI_TOKEN:Record<string, string> = {
    black         : "var(--mp-terminal-bg-2)",
    red           : "var(--mp-terminal-red)",
    green         : "var(--mp-terminal-green)",
    yellow        : "var(--mp-terminal-orange)",
    blue          : "var(--mp-terminal-blue)",
    magenta       : "var(--mp-accent-pink)",
    cyan          : "var(--mp-accent-cyan)",
    white         : "var(--mp-terminal-fg)",
    brightBlack   : "var(--mp-terminal-muted)",
    brightRed     : "var(--mp-terminal-red)",
    brightGreen   : "var(--mp-terminal-green)",
    brightYellow  : "var(--mp-accent-yellow)",
    brightBlue    : "var(--mp-terminal-blue)",
    brightMagenta : "var(--mp-accent-violet)",
    brightCyan    : "var(--mp-accent-cyan)",
    brightWhite   : "var(--mp-terminal-fg)"
}

const AnsiColor = (index:number):string => ANSI_TOKEN[AnsiPaletteKey(index)]

export const ParseAnsi = (text:string):AnsiSegment[] => {
    const segments:AnsiSegment[] = []
    let state:AnsiSegment = { text: "" }
    let cursor = 0

    const Push = (piece:string) => {
        if(!piece) return
        segments.push({ ...state, text: piece })
    }

    ANSI_PATTERN.lastIndex = 0
    let match = ANSI_PATTERN.exec(text)
    while(match){
        Push(text.slice(cursor, match.index))
        cursor = match.index + match[0].length

        // Sequência que não é SGR: some da tela, sem mudar aparência.
        if(match[2] === "m"){
            const codes = (match[1] || "0").split(";").map((code) => Number(code) || 0)
            for(let position = 0; position < codes.length; position++){
                const code = codes[position]
                if(code === 0) state = { text: "" }
                else if(code === 1) state.bold = true
                else if(code === 2) state.dim = true
                else if(code === 4) state.underline = true
                else if(code === 22){ state.bold = false; state.dim = false }
                else if(code === 24) state.underline = false
                else if(code >= 30 && code <= 37) state.color = AnsiColor(code - 30)
                else if(code >= 90 && code <= 97) state.color = AnsiColor(code - 90 + 8)
                else if(code >= 40 && code <= 47) state.background = AnsiColor(code - 40)
                else if(code >= 100 && code <= 107) state.background = AnsiColor(code - 100 + 8)
                else if(code === 39) state.color = undefined
                else if(code === 49) state.background = undefined
                else if(code === 38 || code === 48){
                    // 5;n = paleta de 256; 2;r;g;b = cor direta. Só os 16
                    // primeiros índices têm token; o resto é ignorado de
                    // propósito, porque a alternativa seria escrever um
                    // rgb() literal — cor que não segue o tema.
                    const target = code === 38 ? "color" : "background"
                    if(codes[position + 1] === 5){
                        const index = codes[position + 2]
                        if(index < 16) (state as any)[target] = AnsiColor(index)
                        position += 2
                    } else if(codes[position + 1] === 2) position += 4
                }
            }
        }

        match = ANSI_PATTERN.exec(text)
    }
    Push(text.slice(cursor))

    return segments.length ? segments : [ { text } ]
}

const AnsiText = ({ text }:{ text:string }) => <>
    {
        ParseAnsi(text).map((segment, index) => <span
            key={index}
            className={`${segment.bold ? "is-bold " : ""}${segment.dim ? "is-dim " : ""}${segment.underline ? "is-underline" : ""}`.trim() || undefined}
            style={{ color: segment.color, background: segment.background }}>
            {segment.text}
        </span>)
    }
</>

/* ------------------------------------------------------------------ */
/* Componente                                                         */
/* ------------------------------------------------------------------ */

type VisibleEntry = { entry:LogEntry, index:number, level?:string, text:string }

const LogViewer = ({
    entries,
    lines,
    height          = 360,
    maxLines        = 4000,
    levels          = LOG_LEVELS,
    defaultLevels   = [],
    defaultFollow   = true,
    defaultWrap     = false,
    ansi            = "render",
    showToolbar     = true,
    showLineNumbers = true,
    showLevelFilter = true,
    rowHeight       = 18,
    emptyLabel      = "nenhuma linha registrada ainda.",
    toolbarExtra,
    meta,
    className       = "",
    onFilterChange,
    onLevelsChange,
    onFollowChange,
    onClear
}:LogViewerProps) => {

    const [ filter, setFilter ]           = useState("")
    const [ activeLevels, setLevels ]     = useState<string[]>(defaultLevels)
    const [ follow, setFollow ]           = useState(defaultFollow)
    const [ wrap, setWrap ]               = useState(defaultWrap)
    // Limpeza local: o buffer é do dono, então "limpar" sem `onClear` só esconde
    // o que já passou, e o corte é registrado para não mentir na contagem.
    const [ hiddenBefore, setHidden ]     = useState(0)
    const [ scrollTop, setScrollTop ]     = useState(0)
    const [ viewportHeight, setViewport ] = useState(0)

    const bodyRef = useRef<HTMLDivElement>(null)

    const normalized = useMemo(() => {
        const source:LogEntry[] = entries
            ? entries
            : (lines || []).map((line:string) => ({ message: line, raw: true }))
        return source.length > maxLines ? source.slice(source.length - maxLines) : source
    }, [entries, lines, maxLines])

    const dropped = (entries ? entries.length : (lines || []).length) - normalized.length

    const prepared = useMemo(() => normalized.slice(hiddenBefore).map((entry, index) => {
        const message = entry.message === undefined || entry.message === null ? "" : String(entry.message)
        return {
            entry,
            index,
            level : entry.level || GuessLevel(message),
            text  : ansi === "strip" ? StripAnsi(message) : message
        } as VisibleEntry
    }), [normalized, hiddenBefore, ansi])

    const visible = useMemo(() => {
        const needle = filter.trim().toLowerCase()
        if(!needle && !activeLevels.length) return prepared
        return prepared.filter((item) => {
            if(activeLevels.length && !activeLevels.includes(item.level || "")) return false
            if(!needle) return true
            const haystack = `${item.entry.source || ""} ${item.text}`.toLowerCase()
            return haystack.includes(needle)
        })
    }, [prepared, filter, activeLevels])

    // Virtualização: com quebra de linha a altura vira variável e a conta deixa
    // de valer, então o modo quebrado renderiza tudo (e é por isso que ele é
    // opcional, não o padrão).
    const virtualized = !wrap && visible.length > 200
    const firstRow = virtualized ? Math.max(0, Math.floor(scrollTop / rowHeight) - 10) : 0
    const lastRow  = virtualized
        ? Math.min(visible.length, Math.ceil((scrollTop + (viewportHeight || 400)) / rowHeight) + 10)
        : visible.length
    const rows = virtualized ? visible.slice(firstRow, lastRow) : visible

    // Autoscroll só enquanto o usuário quer acompanhar: sem a trava, o log
    // arrastaria a leitura de volta para o fim a cada linha nova — a maneira
    // mais rápida de tornar um log inútil.
    useEffect(() => {
        const element = bodyRef.current
        if(!follow || !element) return
        element.scrollTop = element.scrollHeight
    }, [visible.length, follow, wrap])

    useEffect(() => {
        const element = bodyRef.current
        if(!element) return
        const Measure = () => setViewport(element.clientHeight)
        Measure()
        const ResizeObserverImpl = (window as any).ResizeObserver
        if(ResizeObserverImpl){
            const observer = new ResizeObserverImpl(Measure)
            observer.observe(element)
            return () => observer.disconnect()
        }
        window.addEventListener("resize", Measure)
        return () => window.removeEventListener("resize", Measure)
    }, [])

    const OnScroll = () => {
        const element = bodyRef.current
        if(!element) return
        setScrollTop(element.scrollTop)
        const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24
        if(atBottom !== follow){
            setFollow(atBottom)
            if(onFollowChange) onFollowChange(atBottom)
        }
    }

    const ChangeFilter = (value:string) => {
        setFilter(value)
        if(onFilterChange) onFilterChange(value)
    }

    const ToggleLevel = (level:string) => {
        const next = activeLevels.includes(level)
            ? activeLevels.filter((item) => item !== level)
            : activeLevels.concat([ level ])
        setLevels(next)
        if(onLevelsChange) onLevelsChange(next)
    }

    const ToggleFollow = () => {
        const next = !follow
        setFollow(next)
        if(onFollowChange) onFollowChange(next)
    }

    const Clear = () => {
        if(onClear) onClear()
        else setHidden(normalized.length)
    }

    const Copy = () => {
        const text = visible.map((item) => StripAnsi(item.text)).join("\n")
        try { navigator.clipboard.writeText(text) } catch(_) {}
    }

    const RenderLine = (item:VisibleEntry) => {
        const entry = item.entry
        return <div
            key={entry.id !== undefined ? entry.id : item.index}
            className={`mp-log__line ${item.level ? `mp-log__line--${item.level}` : ""}`.trim()}
            style={virtualized ? { height: rowHeight } : undefined}>
            { showLineNumbers && <span className="mp-log__gutter">{item.index + 1}</span> }
            { entry.ts !== undefined && <span className="mp-log__ts">{String(entry.ts)}</span> }
            { entry.level && <span className="mp-log__level">{entry.level}</span> }
            { entry.source && <span className="mp-log__source">[{entry.source}]</span> }
            <span className="mp-log__text">
                { ansi === "render" ? <AnsiText text={item.text}/> : item.text }
            </span>
            { entry.data !== undefined && entry.data !== null &&
                <span className="mp-log__data">{JSON.stringify(entry.data)}</span> }
        </div>
    }

    return <div
        className={`mp-log ${wrap ? "is-wrap" : ""} ${className}`.trim()}
        style={{ height }}>

        {
            showToolbar &&
            <Toolbar className="mp-log__bar">
                <SearchInput
                    value={filter}
                    onValueChange={ChangeFilter}
                    placeholder="filtrar no log"/>

                {
                    showLevelFilter &&
                    <span className="mp-log__levels">
                        {
                            levels.map((level) => <StatusChip
                                key={level}
                                label={level}
                                tone={LEVEL_TONE[level] || "neutral"}
                                active={activeLevels.includes(level)}
                                onClick={() => ToggleLevel(level)}/>)
                        }
                    </span>
                }

                <Button
                    size="sm"
                    icon="arrow down"
                    variant={follow ? "primary" : "default"}
                    title="rolar automaticamente conforme chegam linhas"
                    onClick={ToggleFollow}>
                    acompanhar
                </Button>

                <Button
                    size="sm"
                    icon="align left"
                    variant={wrap ? "primary" : "default"}
                    title="quebrar linhas longas em vez de rolar na horizontal"
                    onClick={() => setWrap(!wrap)}>
                    quebrar
                </Button>

                <Button size="sm" icon="eraser" onClick={Clear}>limpar</Button>

                <Button size="sm" icon="copy outline" onClick={Copy} disabled={visible.length === 0}>
                    copiar
                </Button>

                { toolbarExtra }

                <Toolbar.Spacer/>

                <span className="mp-log__meta">
                    { filter || activeLevels.length
                        ? `${visible.length}/${prepared.length}`
                        : `${prepared.length}` } linhas
                    { dropped > 0 ? ` · ${dropped} antigas descartadas` : "" }
                    { meta ? <> · {meta}</> : null }
                </span>
            </Toolbar>
        }

        <div className="mp-log__body" ref={bodyRef} onScroll={OnScroll} tabIndex={0}>
            {
                visible.length === 0
                    ? <div className="mp-log__empty">
                        { prepared.length === 0 ? emptyLabel : "nenhuma linha corresponde ao filtro." }
                    </div>
                    : virtualized
                        ? <div className="mp-log__scroller" style={{ height: visible.length * rowHeight }}>
                            <div
                                className="mp-log__window"
                                style={{ transform: `translateY(${firstRow * rowHeight}px)` }}>
                                { rows.map(RenderLine) }
                            </div>
                        </div>
                        : rows.map(RenderLine)
            }
        </div>
    </div>
}

export default LogViewer
