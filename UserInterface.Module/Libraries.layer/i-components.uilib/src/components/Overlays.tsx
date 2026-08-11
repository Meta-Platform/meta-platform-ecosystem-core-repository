import * as React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Icon from "./Icon"
import { Button } from "./Controls"

// Sobreposições do design system (§10.9): diálogo, confirmação, gaveta,
// tooltip e menu de contexto. Todas fecham no Escape e todas usam os tokens
// --mp-z-* para empilhamento — nada de z-index mágico por aplicativo.

const useEscape = (onClose?: () => void) => {
    useEffect(() => {
        if(!onClose) return
        const handle = (event: KeyboardEvent) => { if(event.key === "Escape") onClose() }
        window.addEventListener("keydown", handle)
        return () => window.removeEventListener("keydown", handle)
    }, [onClose])
}

type DialogProps = {
    open?: boolean
    title?: string
    subtitle?: string
    icon?: string
    size?: "sm" | "md" | "lg" | "xl"
    onClose?: () => void
    actions?: React.ReactNode
    children?: React.ReactNode
}

export const Dialog = ({ open = true, title, subtitle, icon, size = "md", onClose, actions, children }: DialogProps) => {
    useEscape(onClose)
    if(!open) return null
    return <div className="mp-dialog-layer">
        <div className="mp-dialog__scrim" onClick={onClose}/>
        <div className={`mp-dialog mp-dialog--${size}`} role="dialog" aria-modal="true" aria-label={title}>
            <header className="mp-dialog__head">
                { icon && <span className="mp-dialog__icon"><Icon name={icon}/></span> }
                <div className="mp-dialog__heading">
                    { title && <h2 className="mp-dialog__title">{title}</h2> }
                    { subtitle && <div className="mp-dialog__subtitle">{subtitle}</div> }
                </div>
                { onClose &&
                    <button type="button" className="mp-dialog__close" aria-label="fechar" onClick={onClose}>
                        <Icon name="times"/>
                    </button> }
            </header>
            <div className="mp-dialog__body">{children}</div>
            { actions && <footer className="mp-dialog__foot">{actions}</footer> }
        </div>
    </div>
}

// Confirmação de ação (inclusive destrutiva). Padroniza a ordem dos botões e o
// destaque da ação perigosa, que variava app a app.
export const ConfirmDialog = ({
    open = true,
    title = "Confirmar ação",
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
    onConfirm,
    onCancel
}: any) =>
    <Dialog
        open={open}
        size="sm"
        title={title}
        icon={danger ? "exclamation triangle" : "question circle"}
        onClose={onCancel}
        actions={<>
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </>}>
        <div className="mp-confirm__message">{message}</div>
    </Dialog>

// Gaveta lateral (usa .mp-offcanvas, já no CSS comum).
export const Drawer = ({ open = true, title, width = 420, side = "right", onClose, children, actions }: any) => {
    useEscape(onClose)
    if(!open) return null
    return <>
        <div className="mp-offcanvas__scrim" onClick={onClose}/>
        <aside
            className={`mp-offcanvas mp-offcanvas--${side}`}
            style={{ width, maxWidth: "100%" }}
            role="dialog"
            aria-label={title}>
            <header className="mp-offcanvas__head">
                <span className="mp-offcanvas__title">{title}</span>
                { onClose &&
                    <button type="button" className="mp-dialog__close" aria-label="fechar" onClick={onClose}>
                        <Icon name="times"/>
                    </button> }
            </header>
            <div className="mp-offcanvas__body">{children}</div>
            { actions && <footer className="mp-offcanvas__foot">{actions}</footer> }
        </aside>
    </>
}

// Tooltip por CSS (sem dependência de posicionamento em JS): cobre o uso
// dominante, que é texto curto num alvo pequeno.
export const Tooltip = ({ content, position = "top", children, className = "" }: any) =>
    <span className={`mp-tooltip mp-tooltip--${position} ${className}`.trim()} data-tooltip={content}>
        {children}
        <span className="mp-tooltip__bubble" role="tooltip">{content}</span>
    </span>

// Menu de contexto/ações. `items` é DADO: [{ key, label, icon, danger,
// disabled, separator, onSelect }] — o mesmo formato que o my-desktop já usa.
//
// Os apelidos `divider`/`onClick` existem porque as implementações locais que
// foram absorvidas (my-desktop e package-developer) nomeavam assim; as duas
// grafias valem, e nenhuma some.
export type MenuItem = {
    key?: string
    label?: string
    icon?: string
    danger?: boolean
    disabled?: boolean
    separator?: boolean
    // apelido de `separator`
    divider?: boolean
    // marca de seleção; substitui o ícone do item quando ligada
    checked?: boolean
    // submenu expansível em linha (um nível)
    children?: MenuItem[]
    onSelect?: () => void
    // apelido de `onSelect`
    onClick?: () => void
}

const IsSeparator = (item: MenuItem) => Boolean(item.separator || item.divider)
const ItemKey = (item: MenuItem, index: number) => item.key || String(index)
const Select = (item: MenuItem) => { (item.onSelect || item.onClick) && (item.onSelect || item.onClick)!() }

// Lista de itens compartilhada pelo Menu e pelo ContextMenu. Guarda qual
// submenu está aberto e avisa quem a hospeda (`onLayoutChange`), porque abrir
// um submenu muda a altura da caixa — e o ContextMenu precisa remedir para não
// escorregar para fora da tela.
const MenuItems = ({ items, onClose, onLayoutChange }:
    { items: MenuItem[], onClose?: () => void, onLayoutChange?: () => void }) => {

    const [ openKey, setOpenKey ] = useState<string>()

    useEffect(() => { onLayoutChange && onLayoutChange() }, [ openKey ])

    const Leaf = (item: MenuItem, key: string, isChild: boolean) =>
        <button
            type="button"
            role="menuitem"
            key={key}
            disabled={item.disabled}
            className={[
                "mp-menu__item",
                isChild ? "mp-menu__item--child" : "",
                item.danger ? "is-danger" : "",
                item.checked ? "is-checked" : ""
            ].filter(Boolean).join(" ")}
            onClick={() => { Select(item); onClose && onClose() }}>
            { item.checked
                ? <Icon name="check" tone="success"/>
                : item.icon
                    ? <Icon name={item.icon}/>
                    : <span className="mp-menu__icon-gap" aria-hidden="true"/> }
            <span className="mp-menu__label">{item.label}</span>
        </button>

    return <>
        {
            items.map((item, index) => {
                const key = ItemKey(item, index)

                if(IsSeparator(item))
                    return <span className="mp-menu__sep" key={key} aria-hidden="true"/>

                if(item.children && item.children.length > 0){
                    const isOpen = openKey === key
                    return <React.Fragment key={key}>
                        <button
                            type="button"
                            role="menuitem"
                            aria-expanded={isOpen}
                            disabled={item.disabled}
                            className={`mp-menu__item ${isOpen ? "is-open" : ""}`.trim()}
                            onClick={() => setOpenKey(isOpen ? undefined : key)}>
                            { item.icon
                                ? <Icon name={item.icon}/>
                                : <span className="mp-menu__icon-gap" aria-hidden="true"/> }
                            <span className="mp-menu__label">{item.label}</span>
                            <Icon name={isOpen ? "angle down" : "angle right"} tone="muted"/>
                        </button>
                        {
                            isOpen && item.children.map((child, childIndex) =>
                                IsSeparator(child)
                                    ? <span className="mp-menu__sep" key={ItemKey(child, childIndex)} aria-hidden="true"/>
                                    : Leaf(child, ItemKey(child, childIndex), true))
                        }
                    </React.Fragment>
                }

                return Leaf(item, key, false)
            })
        }
    </>
}

export const Menu = ({ items = [], onClose, className = "" }:
    { items?: MenuItem[], onClose?: () => void, className?: string }) => {
    useEscape(onClose)
    return <div className={`mp-menu ${className}`.trim()} role="menu">
        <MenuItems items={items} onClose={onClose}/>
    </div>
}

export type ContextMenuProps = {
    x: number
    y: number
    items?: MenuItem[]
    onClose?: () => void
    // distância mínima da borda da tela ao recortar a posição
    margin?: number
    // rolar a página fecha o menu (ele ficaria ancorado no vazio)
    closeOnScroll?: boolean
    className?: string
}

// Menu ancorado em coordenadas de tela (clique com o botão direito).
//
// Recorta a posição para a caixa nascer INTEIRA dentro da viewport: sem isso um
// clique perto da borda direita ou de baixo abre um menu com metade fora da
// tela. A medida é feita depois de pintar (useLayoutEffect) e refeita quando um
// submenu abre e muda a altura.
export const ContextMenu = ({
    x, y, items = [], onClose, margin = 8, closeOnScroll = true, className = ""
}: ContextMenuProps) => {

    const ref = useRef<HTMLDivElement>(null)
    const [ position, setPosition ] = useState({ x, y })

    useEscape(onClose)

    const Clamp = useCallback(() => {
        const element = ref.current
        if(!element) return
        const rect = element.getBoundingClientRect()
        setPosition({
            x: Math.max(margin, Math.min(x, window.innerWidth  - rect.width  - margin)),
            y: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))
        })
    }, [ x, y, margin ])

    useLayoutEffect(() => { Clamp() }, [ Clamp ])

    useEffect(() => {
        if(!closeOnScroll || !onClose) return
        const handle = () => onClose()
        window.addEventListener("scroll", handle, true)
        return () => window.removeEventListener("scroll", handle, true)
    }, [ closeOnScroll, onClose ])

    return <>
        <div className="mp-menu__scrim" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose && onClose() }}/>
        <div ref={ref} className="mp-menu-anchor" style={{ left: position.x, top: position.y }}>
            <div className={`mp-menu ${className}`.trim()} role="menu">
                <MenuItems items={items} onClose={onClose} onLayoutChange={Clamp}/>
            </div>
        </div>
    </>
}

// Popover ancorado no fluxo (dropdown de ações, seletor de tema, etc.).
export const Popover = ({ open = true, align = "right", trigger, onClose, children, className = "" }: any) => {
    useEscape(onClose)
    return <span className={`mp-popover ${className}`.trim()}>
        {trigger}
        { open && <>
            <span className="mp-popover__scrim" onClick={onClose}/>
            <span className={`mp-popover__panel mp-popover__panel--${align}`}>{children}</span>
        </> }
    </span>
}
