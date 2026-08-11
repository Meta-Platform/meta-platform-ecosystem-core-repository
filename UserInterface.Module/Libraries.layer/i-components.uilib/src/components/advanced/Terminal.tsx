import * as React from "react"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import type { ITheme } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"

import { useTokenPalette } from "../../theme/palette"
import type { TokenPalette } from "../../theme/palette"

// Emulador de terminal do kit — xterm.js embrulhado no design system.
//
// De onde veio: existiam duas implementações à mão, com o mesmo miolo e
// divergindo no resto. A do launcher (ExecutionTerminal) sabia redimensionar e
// limpar o recurso, mas vinha grudada no protocolo do daemon (RunPackage +
// WebSocket). A do container-manager (XTerminal) era genérica e melhor
// desenhada, porém pintava com dois hexadecimais fixos ("#0b0e14"/"#d5d8de") —
// isto é, ignorava o tema — e declarava o pacote `xterm` antigo em vez do
// escopado `@xterm/xterm`.
//
// Este componente é a segunda, generalizada: nada de domínio, tudo por prop e
// callback, e a cor vindo dos tokens --mp-terminal-*.
//
// Por que a cor sai de JavaScript: o xterm pinta em canvas/webgl e não enxerga
// CSS. Ele recebe a paleta por opção; quando o usuário troca de tema,
// `useTokenPalette` relê os tokens e um efeito troca `terminal.options.theme`
// — sem recriar o terminal, que perderia todo o histórico da tela.

export type TerminalSize = { cols:number, rows:number }

// A superfície imperativa. Um terminal é um dispositivo, não um valor: quem
// monta empurra bytes conforme eles chegam do processo. Por isso escrita e foco
// são chamadas, e não props.
export type TerminalHandle = {
    Write     : (data:string) => void
    WriteLine : (line:string) => void
    Clear     : () => void
    Reset     : () => void
    Focus     : () => void
    Fit       : () => void
    ScrollToBottom : () => void
    Size      : () => TerminalSize
}

export type TerminalProps = {
    // Tudo que o usuário digita (já em bytes de terminal, inclusive as teclas
    // de controle). Quem monta manda isso para o processo do outro lado.
    onData?        : (data:string) => void
    // Novo tamanho em células, depois de cada `fit`. É o que o processo remoto
    // precisa saber para desenhar certo — sem isso, um `top` continua pintando
    // para 80x24 dentro de uma janela grande.
    onResize?      : (size:TerminalSize) => void
    // Chamado uma vez, na montagem, com a API de escrita.
    onReady?       : (handle:TerminalHandle) => void
    // Sequência OSC 0/2 emitida pelo programa (o "título" da janela).
    onTitleChange? : (title:string) => void
    // Escrito uma única vez, logo após abrir — cabeçalho, aviso, banner.
    initialText?   : string
    fontSize?      : number
    // Linhas mantidas acima do topo. Cada linha custa memória; 5.000 é o teto
    // usado hoje pelos painéis da plataforma.
    scrollback?    : number
    cursorBlink?   : boolean
    // Terminal de leitura (log ao vivo, saída de build): o teclado não é
    // enviado e o cursor some.
    readOnly?      : boolean
    // Traduz \n solto em \r\n. Ligado por padrão porque saída de processo que
    // não emite carriage return escadaria para a direita.
    convertEol?    : boolean
    height?        : number | string
    className?     : string
    style?         : React.CSSProperties
    // Rótulo acessível da região.
    label?         : string
}

// A tabela ANSI do kit. Só há oito tokens de terminal, e é de propósito: o que
// falta é preenchido pelos acentos do design system, não por hexadecimal novo.
// Trocar de tema troca esta tabela inteira.
export const BuildTerminalTheme = (palette:TokenPalette):ITheme => ({
    background          : palette.terminal.bg,
    foreground          : palette.terminal.fg,
    cursor              : palette.terminal.green,
    cursorAccent        : palette.terminal.bg,
    // A seleção é opaca de propósito: com transparência seria preciso inventar
    // um rgba() — e um rgba() literal é exatamente a cor que não segue o tema.
    selectionBackground : palette.terminal.muted,
    selectionForeground : palette.terminal.bg,

    black         : palette.terminal.bg2,
    red           : palette.terminal.red,
    green         : palette.terminal.green,
    yellow        : palette.terminal.orange,
    blue          : palette.terminal.blue,
    magenta       : palette.accents.pink,
    cyan          : palette.accents.cyan,
    white         : palette.terminal.fg,

    brightBlack   : palette.terminal.muted,
    brightRed     : palette.terminal.red,
    brightGreen   : palette.terminal.green,
    brightYellow  : palette.accents.yellow,
    brightBlue    : palette.terminal.blue,
    brightMagenta : palette.accents.violet,
    brightCyan    : palette.accents.cyan,
    brightWhite   : palette.terminal.fg
})

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({
    onData,
    onResize,
    onReady,
    onTitleChange,
    initialText,
    fontSize   = 13,
    scrollback = 5000,
    cursorBlink = true,
    readOnly   = false,
    convertEol = true,
    height     = "100%",
    className  = "",
    style,
    label      = "terminal"
}:TerminalProps, ref) => {

    const elementRef  = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<XTerm | null>(null)
    const fitRef      = useRef<FitAddon | null>(null)

    // Os callbacks vivem em ref porque o efeito de montagem roda UMA vez: sem
    // isso ele congelaria a primeira versão de cada função e o terminal
    // continuaria escrevendo no socket antigo depois de uma reconexão.
    const onDataRef   = useRef(onData)
    const onResizeRef = useRef(onResize)
    const onTitleRef  = useRef(onTitleChange)
    onDataRef.current   = onData
    onResizeRef.current = onResize
    onTitleRef.current  = onTitleChange

    const palette = useTokenPalette()
    const theme   = useMemo(() => BuildTerminalTheme(palette), [palette])

    const handle:TerminalHandle = useMemo(() => ({
        Write     : (data:string) => { terminalRef.current && terminalRef.current.write(data) },
        WriteLine : (line:string) => { terminalRef.current && terminalRef.current.writeln(line) },
        Clear     : () => { terminalRef.current && terminalRef.current.clear() },
        Reset     : () => { terminalRef.current && terminalRef.current.reset() },
        Focus     : () => { terminalRef.current && terminalRef.current.focus() },
        Fit       : () => { try { fitRef.current && fitRef.current.fit() } catch(_) {} },
        ScrollToBottom : () => { terminalRef.current && terminalRef.current.scrollToBottom() },
        Size      : () => terminalRef.current
            ? { cols: terminalRef.current.cols, rows: terminalRef.current.rows }
            : { cols: 0, rows: 0 }
    }), [])

    useImperativeHandle(ref, () => handle, [handle])

    useEffect(() => {
        const element = elementRef.current
        if(!element) return

        const terminal = new XTerm({
            fontSize,
            fontFamily : palette.fontMono,
            cursorBlink,
            convertEol,
            scrollback,
            disableStdin : readOnly,
            cursorStyle  : "block",
            theme
        })

        const fit = new FitAddon()
        terminal.loadAddon(fit)
        terminal.open(element)
        // Aba escondida / flex ainda sem largura: `fit` lança, e é esperado. O
        // ResizeObserver abaixo corrige assim que o elemento ganhar tamanho.
        try { fit.fit() } catch(_) {}

        terminalRef.current = terminal
        fitRef.current      = fit

        const dataListener   = terminal.onData((data:string) => onDataRef.current && onDataRef.current(data))
        const resizeListener = terminal.onResize((size:TerminalSize) =>
            onResizeRef.current && onResizeRef.current({ cols: size.cols, rows: size.rows }))
        const titleListener  = terminal.onTitleChange((title:string) => onTitleRef.current && onTitleRef.current(title))

        if(initialText) terminal.write(initialText)
        if(onReady) onReady(handle)

        // O terminal muda de tamanho pela JANELA e também pelo painel ao lado;
        // observar o próprio elemento cobre os dois casos, e o listener de
        // `resize` da janela não cobria o segundo.
        let observer:any
        const ResizeObserverImpl = (window as any).ResizeObserver
        const Refit = () => { try { fit.fit() } catch(_) {} }
        if(ResizeObserverImpl){
            observer = new ResizeObserverImpl(Refit)
            observer.observe(element)
        } else {
            window.addEventListener("resize", Refit)
        }

        // Sem isto, cada abertura de terminal deixa canvas, observadores e
        // listeners de teclado vivos numa aba que o usuário já fechou.
        return () => {
            if(observer) observer.disconnect()
            else window.removeEventListener("resize", Refit)
            dataListener.dispose()
            resizeListener.dispose()
            titleListener.dispose()
            terminal.dispose()
            terminalRef.current = null
            fitRef.current      = null
        }
        // Montagem única de propósito: trocar de fonte, de tema ou de tamanho
        // são opções, e recriar o terminal apagaria o histórico da tela.
    }, [])

    // Tema em execução: o CSS reage sozinho ao data-theme, o canvas não.
    useEffect(() => {
        if(!terminalRef.current) return
        terminalRef.current.options.theme      = theme
        terminalRef.current.options.fontFamily = palette.fontMono
    }, [theme, palette.fontMono])

    useEffect(() => {
        if(!terminalRef.current) return
        terminalRef.current.options.fontSize    = fontSize
        terminalRef.current.options.scrollback  = scrollback
        terminalRef.current.options.cursorBlink = cursorBlink
        terminalRef.current.options.disableStdin = readOnly
        try { fitRef.current && fitRef.current.fit() } catch(_) {}
    }, [fontSize, scrollback, cursorBlink, readOnly])

    return <div
        className={`mp-terminal ${readOnly ? "is-readonly" : ""} ${className}`.trim()}
        style={{ height, ...style }}
        role="group"
        aria-label={label}>
        <div className="mp-terminal__screen" ref={elementRef}/>
    </div>
})

Terminal.displayName = "Terminal"

export default Terminal
