import * as React from "react"
import { SYMBOLS, ResolveSymbolName } from "./icons/symbols"

// Ícone canônico do design system. É o componente MAIS usado da plataforma
// (1.823 chamadas nos WebGui e nas .uilib — ver o inventário do APPUI-113),
// por isso os aplicativos NUNCA importam ícone de biblioteca de terceiro:
// importam daqui.
//
// O desenho é do kit: SVG em linha, grade 24×24, traço herdando `currentColor`
// (símbolos em ./icons/symbols.tsx). Herdar a cor é o que faz o ícone
// acompanhar os tokens --mp-* do contexto em que ele está.
//
// Duas correções que todo call site repetia à mão continuam aqui:
//   - `margin: 0` (a folha de origem embutia margem lateral que desalinhava
//     chips e botões);
//   - cor pelos tokens --mp-* em vez de paleta de terceiro.
//
// REGRA DURA: nome sem símbolo NÃO some — desenha um quadrado cortado e diz,
// em title/aria-label, qual nome foi pedido. "Ícone some em silêncio" já
// custou uma investigação nesta plataforma.
//
// props:
//   name    nome do ícone (o conjunto herdado do Semantic continua valendo)
//   tone    neutral | muted | success | warning | danger | info | inherit
//   size    mini | tiny | small | large | big | huge | massive
//   spaced  true mantém a margem lateral original (casos de texto corrido)
export type IconTone = "neutral" | "muted" | "success" | "warning" | "danger" | "info" | "inherit"

const TONE_VAR: { [tone: string]: string | undefined } = {
    neutral: "var(--mp-ink)",
    muted:   "var(--mp-muted)",
    success: "var(--mp-success)",
    warning: "var(--mp-warning)",
    danger:  "var(--mp-danger)",
    info:    "var(--mp-accent-blue)",
    inherit: undefined
}

// A prop `color` é herança do conjunto antigo (nomes de cor, não tokens).
// Ela continua aceita, mas cada nome cai num token --mp-*: o kit não tem
// paleta paralela.
const COLOR_VAR: { [color: string]: string } = {
    red:    "var(--mp-danger)",
    orange: "var(--mp-accent-orange)",
    yellow: "var(--mp-accent-yellow)",
    olive:  "var(--mp-success)",
    green:  "var(--mp-success)",
    teal:   "var(--mp-accent-cyan)",
    blue:   "var(--mp-accent-blue)",
    violet: "var(--mp-accent-violet)",
    purple: "var(--mp-accent-violet)",
    pink:   "var(--mp-accent-pink)",
    brown:  "var(--mp-muted)",
    grey:   "var(--mp-muted)",
    gray:   "var(--mp-muted)",
    black:  "var(--mp-ink)"
}

const SIZES = [ "mini", "tiny", "small", "large", "big", "huge", "massive" ]

// Marcador de ícone ausente: quadrado com traço. Tem de ser reconhecível de
// relance e diferente de qualquer símbolo real.
const MISSING = <>
    <rect x="3.5" y="3.5" width="17" height="17"/>
    <line x1="3.5" y1="20.5" x2="20.5" y2="3.5"/>
</>

// Um aviso por nome, não por render.
const warned: { [name: string]: boolean } = {}

const Icon = ({
    name,
    tone = "inherit",
    spaced = false,
    size,
    color,
    className = "",
    style,
    fitted,
    link,
    loading,
    disabled,
    bordered,
    circular,
    inverted,
    corner,
    flipped,
    rotated,
    title,
    as: Element = "i",
    children,
    ...props
}: any) => {

    const symbolName = ResolveSymbolName(name)

    if (symbolName === null && !warned[String(name)]) {
        warned[String(name)] = true
        // eslint-disable-next-line no-console
        console.warn(`[i-components] Icon: não há símbolo para "${name}". `
            + "Desenhando o marcador de ícone ausente — acrescente o símbolo em "
            + "src/components/icons/symbols.tsx ou um apelido em ALIASES.")
    }

    const label = title || (symbolName === null ? `ícone ausente: ${name}` : undefined)

    const classes = [
        // `icon` fica por compatibilidade: há CSS de aplicativo mirando
        // `.mp-status-chip .icon` e afins. A geometria é toda de `.mp-icon`.
        "icon",
        "mp-icon",
        symbolName === null ? "mp-icon--missing" : "",
        size && SIZES.indexOf(size) >= 0 ? `${size} mp-icon--${size}` : "",
        fitted ? "fitted mp-icon--fitted" : "",
        link ? "link mp-icon--link" : "",
        loading ? "loading mp-icon--loading" : "",
        disabled ? "disabled mp-icon--disabled" : "",
        bordered ? "bordered mp-icon--bordered" : "",
        circular ? "circular mp-icon--circular" : "",
        inverted ? "inverted mp-icon--inverted" : "",
        corner ? "corner mp-icon--corner" : "",
        flipped ? `mp-icon--flipped-${flipped}` : "",
        rotated ? `mp-icon--rotated-${rotated}` : "",
        className
    ].filter(Boolean).join(" ").trim()

    const resolved = color ? (COLOR_VAR[color] || color) : TONE_VAR[tone]

    return <Element
        className={classes}
        title={title}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : "true"}
        style={{
            ...(spaced ? {} : { margin: 0 }),
            ...(resolved ? { color: resolved } : {}),
            ...style
        }}
        {...props}>
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="square"
            strokeLinejoin="miter"
            focusable="false"
            aria-hidden="true">
            { symbolName === null ? MISSING : SYMBOLS[symbolName] }
        </svg>
    </Element>
}

export default Icon
export { SYMBOLS, ALIASES, ALIASES_BY_SYMBOL, SYMBOL_NAMES, ICON_NAMES, ResolveSymbolName } from "./icons/symbols"
