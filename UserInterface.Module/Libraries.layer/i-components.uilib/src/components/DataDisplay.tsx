import * as React from "react"
import Icon from "./Icon"
import { EmptyState } from "./Feedback"

// Exibição de dados (§9, §11.2): painel, tabela, lista, árvore, cartão de
// objeto, tile de contagem, lista chave/valor, abas e grupos colapsáveis.
// São os padrões que cada WebGui reimplementava com tabela/lista/segmento de
// biblioteca de terceiro mais um CSS local por aplicativo.

// Painel com cabeçalho e corpo — a moldura de qualquer seção de conteúdo.
export const Panel = ({ title, icon, actions, footer, children, className = "" }: any) =>
    <section className={`mp-ov-panel ${className}`.trim()}>
        { (title || actions) &&
            <header className="mp-ov-panel__head">
                <span className="mp-panel__title">
                    { icon && <Icon name={icon}/> }
                    {title}
                </span>
                { actions && <span className="mp-panel__actions">{actions}</span> }
            </header> }
        <div className="mp-ov-panel__body">{children}</div>
        { footer && <footer className="mp-panel__foot">{footer}</footer> }
    </section>

// Linha de lista clicável (usa .mp-ov-row do CSS comum).
// `iconNode` cobre o caso em que o ícone não é um nome do kit e sim um nó
// pronto (imagem do pacote, marca do repositório, avatar). Sem ele, três
// migrações independentes tiveram de trocar ListRow por marcação à mão.
export const ListRow = ({ icon, iconNode, title, meta, right, selected, onClick, className = "" }: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            onClick,
            className: [
                "mp-ov-row",
                selected ? "is-selected" : "",
                clickable ? "is-clickable" : "",
                className
            ].filter(Boolean).join(" ")
        },
        <>
            { (iconNode || icon) && <span className="mp-row__icon">{ iconNode || <Icon name={icon}/> }</span> }
            <span className="mp-row__body">
                <span className="mp-row__title">{title}</span>
                { meta && <span className="mp-row__meta">{meta}</span> }
            </span>
            { right && <span className="mp-row__right">{right}</span> }
        </>
    )
}

// Tabela de dados dirigida por DADOS:
//   columns: [{ key, header, width, align, mono, render(row) }]
//   rows:    qualquer objeto; `rowKey` extrai a chave estável.
export type DataColumn = {
    key: string
    header: string
    width?: number | string
    align?: "left" | "right" | "center"
    mono?: boolean
    render?: (row: any) => React.ReactNode
}

export const DataTable = ({
    columns = [],
    rows = [],
    rowKey,
    onRowClick,
    selectedKey,
    dense = false,
    emptyMessage = "Nenhum registro.",
    className = ""
}: {
    columns?: DataColumn[]
    rows?: any[]
    rowKey?: (row: any, index: number) => string
    onRowClick?: (row: any) => void
    selectedKey?: string
    dense?: boolean
    emptyMessage?: string
    className?: string
}) => {
    if(!rows.length) return <EmptyState icon="table" message={emptyMessage}/>
    const KeyOf = (row: any, index: number) => rowKey ? rowKey(row, index) : String(index)
    return <div className={`mp-table-wrap ${className}`.trim()}>
        <table className={`mp-table ${dense ? "is-dense" : ""}`.trim()}>
            <thead>
                <tr>
                    { columns.map((column) =>
                        <th
                            key={column.key}
                            style={{ width: column.width, textAlign: column.align || "left" }}>
                            {column.header}
                        </th>) }
                </tr>
            </thead>
            <tbody>
                { rows.map((row, index) => {
                    const key = KeyOf(row, index)
                    return <tr
                        key={key}
                        className={[
                            onRowClick ? "is-clickable" : "",
                            selectedKey === key ? "is-selected" : ""
                        ].filter(Boolean).join(" ")}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}>
                        { columns.map((column) =>
                            <td
                                key={column.key}
                                className={column.mono ? "is-mono" : undefined}
                                style={{ textAlign: column.align || "left" }}>
                                { column.render ? column.render(row) : row[column.key] }
                            </td>) }
                    </tr>
                }) }
            </tbody>
        </table>
    </div>
}

// Linha de árvore (explorador de pacotes, estrutura de repositório, boot).
// `iconNode` tem a mesma razão de ser que em ListRow: nó pronto no lugar do
// nome de símbolo (ícone próprio do pacote, bandeira de status desenhada).
export const TreeRow = ({
    label,
    icon,
    iconNode,
    depth = 0,
    expanded,
    hasChildren = false,
    selected = false,
    dirty = false,
    meta,
    onToggle,
    onSelect,
    className = ""
}: any) =>
    <div
        className={[
            "mp-tree-row",
            selected ? "is-selected" : "",
            dirty ? "is-dirty" : "",
            className
        ].filter(Boolean).join(" ")}
        style={{ paddingLeft: 8 + depth * 14 }}
        role="treeitem"
        aria-expanded={hasChildren ? Boolean(expanded) : undefined}>
        { hasChildren
            ? <button
                type="button"
                className="mp-tree-row__twisty"
                aria-label={expanded ? "recolher" : "expandir"}
                onClick={(event) => { event.stopPropagation(); onToggle && onToggle() }}>
                <Icon name={expanded ? "caret down" : "caret right"}/>
            </button>
            : <span className="mp-tree-row__twisty is-empty"/> }
        <button type="button" className="mp-tree-row__main" onClick={onSelect}>
            { iconNode
                ? <span className="mp-tree-row__icon">{iconNode}</span>
                : icon && <Icon name={icon} className="mp-tree-row__icon"/> }
            <span className="mp-tree-row__label">{label}</span>
            { meta && <span className="mp-tree-row__meta">{meta}</span> }
        </button>
    </div>

// Cartão de objeto (§9.3) — pacote, instância, repositório, projeto.
export const ObjectCard = ({
    icon,
    iconNode,
    title,
    meta,
    status,
    chips,
    right,
    selected = false,
    dim = false,
    onClick,
    className = ""
}: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            onClick,
            className: [
                "mp-object-card",
                clickable ? "is-clickable" : "",
                selected ? "is-selected" : "",
                dim ? "is-dim" : "",
                className
            ].filter(Boolean).join(" ")
        },
        <>
            <span className="mp-object-card__icon">{ iconNode || <Icon name={icon || "cube"}/> }</span>
            <span className="mp-object-card__title" title={typeof title === "string" ? title : undefined}>{title}</span>
            { status && <span className="mp-object-card__status">{status}</span> }
            { meta && <span className="mp-object-card__meta">{meta}</span> }
            { (chips || right) &&
                <span className="mp-object-card__foot">
                    <span className="mp-object-card__chips">{chips}</span>
                    {right}
                </span> }
        </>
    )
}

// Tile de contagem (faixa de indicadores do topo das telas de operação).
// `subTone` pinta a linha de apoio: muted (padrão) | success | warning |
// danger | info | neutral. Ela é a única cor do tile, então usar tom de
// estado aqui é dizer "este número mudou para melhor/pior".
export const Tile = ({ icon, count, title, sub, subTone = "muted", onClick, className = "" }: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            onClick,
            className: `mp-tile ${className}`.trim()
        },
        <>
            { icon && <span className="mp-tile__icon"><Icon name={icon}/></span> }
            <span className="mp-tile__body">
                <span className="mp-tile__count">{count}</span>
                <span className="mp-tile__title">{title}</span>
                { sub && <span className={`mp-tile__sub mp-tile__sub--${subTone}`}>{sub}</span> }
            </span>
            { clickable && <Icon name="chevron right" className="mp-tile__arrow"/> }
        </>
    )
}

export const TileRow = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-ov-tiles ${className}`.trim()} {...props}/>

// Lista chave/valor para dados técnicos (metadados de pacote, params, boot).
// items: [{ label, value, mono }]
export const KeyValueList = ({ items = [], columns = 1, className = "" }: any) =>
    <dl className={`mp-kv mp-kv--cols-${columns} ${className}`.trim()}>
        { items.filter((item: any) => item && item.value !== undefined && item.value !== null)
            .map((item: any, index: number) =>
                <div className="mp-kv__pair" key={index}>
                    <dt className="mp-kv__label">{item.label}</dt>
                    <dd className={`mp-kv__value ${item.mono ? "is-mono" : ""}`.trim()}>{item.value}</dd>
                </div>) }
    </dl>

// Abas de navegação dentro de uma tela.
// tabs: [{ key, label, icon, count, disabled }]
// ATENÇÃO: `Tabs` é só a BARRA. O conteúdo de cada aba vai em `TabPanel`,
// logo abaixo — separados de propósito, porque metade das telas põe algo
// entre a barra e o painel (toolbar, faixa de status).
export const Tabs = ({ tabs = [], activeKey, onChange, className = "" }: any) =>
    <div className={`mp-tabs ${className}`.trim()} role="tablist">
        { tabs.map((tab: any) =>
            <button
                type="button"
                role="tab"
                key={tab.key}
                disabled={tab.disabled}
                aria-selected={tab.key === activeKey}
                className={`mp-tabs__tab ${tab.key === activeKey ? "is-active" : ""}`.trim()}
                onClick={() => onChange && onChange(tab.key)}>
                { tab.icon && <Icon name={tab.icon}/> }
                <span>{tab.label}</span>
                { tab.count !== undefined && <span className="mp-tabs__count">{tab.count}</span> }
            </button>) }
    </div>

// Painel de uma aba. Só desenha quando `tabKey === activeKey`; fora disso
// devolve null, então o conteúdo pesado da aba inativa nem monta.
// `keepMounted` mantém a árvore montada e apenas escondida — para painéis que
// perdem estado caro ao remontar (terminal ligado, canvas com layout).
export const TabPanel = ({ tabKey, activeKey, keepMounted = false, children, className = "" }: any) => {
    const active = tabKey === activeKey
    if(!active && !keepMounted) return null
    return <div
        role="tabpanel"
        id={`mp-tabpanel-${tabKey}`}
        aria-hidden={active ? undefined : "true"}
        hidden={!active}
        className={`mp-tabpanel ${className}`.trim()}>
        {children}
    </div>
}

// Grupos colapsáveis — a outra metade do padrão "editor de configuração"
// (§4 do guia: masthead + banner de sistema + grupos colapsáveis + valores
// mono). Também serve a inspetores e a formulários longos.
//
// items: [{ key, title, icon, meta, disabled, content }]
// Sem `openKeys` o componente controla a abertura sozinho (`defaultOpenKeys`);
// com `openKeys` + `onToggle`, quem controla é a tela.
export type AccordionItem = {
    key: string
    title: React.ReactNode
    icon?: string
    meta?: React.ReactNode
    disabled?: boolean
    content?: React.ReactNode
}

export const Accordion = ({
    items = [],
    openKeys,
    defaultOpenKeys = [],
    onToggle,
    multiple = true,
    className = ""
}: {
    items?: AccordionItem[]
    openKeys?: string[]
    defaultOpenKeys?: string[]
    onToggle?: (key: string, open: boolean) => void
    multiple?: boolean
    className?: string
}) => {

    const [ internal, setInternal ] = React.useState<string[]>(defaultOpenKeys)
    const controlled = Array.isArray(openKeys)
    const open = controlled ? (openKeys as string[]) : internal

    const Toggle = (key: string) => {
        const isOpen = open.indexOf(key) >= 0
        if(!controlled) {
            setInternal(isOpen
                ? open.filter((item) => item !== key)
                : multiple ? [ ...open, key ] : [ key ])
        }
        onToggle && onToggle(key, !isOpen)
    }

    return <div className={`mp-accordion ${className}`.trim()}>
        { items.map((item) => {
            const isOpen = open.indexOf(item.key) >= 0
            return <section className={`mp-accordion__item ${isOpen ? "is-open" : ""}`.trim()} key={item.key}>
                <button
                    type="button"
                    className="mp-accordion__head"
                    disabled={item.disabled}
                    aria-expanded={isOpen}
                    aria-controls={`mp-accordion-body-${item.key}`}
                    onClick={() => Toggle(item.key)}>
                    <Icon name={isOpen ? "caret down" : "caret right"} className="mp-accordion__twisty"/>
                    { item.icon && <Icon name={item.icon} className="mp-accordion__icon"/> }
                    <span className="mp-accordion__title">{item.title}</span>
                    { item.meta !== undefined && item.meta !== null &&
                        <span className="mp-accordion__meta">{item.meta}</span> }
                </button>
                { isOpen &&
                    <div className="mp-accordion__body" id={`mp-accordion-body-${item.key}`}>
                        {item.content}
                    </div> }
            </section>
        }) }
    </div>
}

// Bloco de código/saída técnica em monoespaçada (logs curtos, JSON, comando).
export const CodeBlock = ({ children, language, className = "" }: any) =>
    <pre className={`mp-code ${className}`.trim()} data-language={language}>
        <code>{children}</code>
    </pre>
