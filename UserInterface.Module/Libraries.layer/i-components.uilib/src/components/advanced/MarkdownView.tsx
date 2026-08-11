import * as React from "react"
import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"

// Markdown renderizado do design system (marked + dompurify).
//
// Derivado do `Markdown.tsx` do Meta Project Manager, que já fazia a coisa
// certa: converte com `marked` e SANITIZA o HTML resultante. O Package
// Developer tinha um segundo renderizador, escrito à mão por regex, que não
// entende metade do GFM — as duas telas mostravam o mesmo texto de formas
// diferentes.
//
// Sanitizar não é opção: a descrição de um item pode conter imagem em data-URI
// e texto escrito por um agente de IA. Qualquer caminho de renderização que não
// passe pelo DOMPurify é um XSS esperando acontecer — por isso `RenderMarkdown`
// é o ÚNICO caminho, e ele sanitiza sempre.

marked.setOptions({ gfm: true, breaks: true })

export interface RenderMarkdownOptions {
    // atributos extras que o sanitizador deve preservar. O MPM marca referências
    // de item num atributo próprio e precisa dele vivo depois da limpeza.
    allowAttributes?: string[]
    // tags extras preservadas (o padrão do DOMPurify já cobre o HTML de texto).
    allowTags?: string[]
}

// Markdown -> HTML JÁ SANITIZADO. Exportado porque quem precisa do HTML (para
// pós-processar, exportar ou medir) deve partir daqui, e não chamar `marked`
// direto — chamar `marked` direto é justamente o caminho sem sanitização.
export const RenderMarkdown = (text?: string, options?: RenderMarkdownOptions): string => {
    if(!text) return ""
    const raw = marked.parse(text, { async: false }) as string
    const config: any = {}
    if(options && options.allowAttributes) config.ADD_ATTR = options.allowAttributes
    if(options && options.allowTags) config.ADD_TAGS = options.allowTags
    return DOMPurify.sanitize(raw, config) as unknown as string
}

export interface MarkdownViewProps extends RenderMarkdownOptions {
    // o texto markdown. Aceito como filho (<MarkdownView>{md}</MarkdownView>)
    // ou como prop `text` — os dois call sites existem nos aplicativos.
    children?: string
    text?: string
    className?: string
    // transformação aplicada DEPOIS da sanitização (linkificar chaves de item,
    // por exemplo). Roda sobre HTML já limpo, e é responsabilidade de quem passa
    // não reintroduzir marcação perigosa.
    transformHtml?: (html: string) => string
    // clique delegado: um handler cobre todos os links/refs do texto.
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
    // o que mostrar quando não há texto.
    empty?: React.ReactNode
    style?: React.CSSProperties
}

export const MarkdownView = ({
    children, text, className = "", transformHtml, onClick, empty, allowAttributes, allowTags, style
}: MarkdownViewProps) => {

    const source = text !== undefined ? text : children

    const html = useMemo(() => {
        const rendered = RenderMarkdown(source, { allowAttributes, allowTags })
        return transformHtml ? transformHtml(rendered) : rendered
    }, [ source, transformHtml, allowAttributes, allowTags ])

    if(!source || !String(source).trim())
        return <>{ empty !== undefined ? empty : <span className="mp-markdown__empty">—</span> }</>

    return <div
        className={`mp-markdown ${className}`}
        style={style}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}/>
}

export default MarkdownView
