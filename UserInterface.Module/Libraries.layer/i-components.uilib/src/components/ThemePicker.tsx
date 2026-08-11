import * as React from "react"
import { useEffect, useState } from "react"
import Icon from "./Icon"
import { IconButton } from "./Controls"
import { Popover, MenuItem } from "./Overlays"
import { THEMES, ThemeName, ApplyTheme, GetSavedTheme } from "../theme"

// Seletor de tema. A LÓGICA de tema já era do kit (THEMES, ApplyTheme,
// GetSavedTheme); o que faltava era o widget — e ele estava reescrito em seis
// aplicativos, cada um com uma casca diferente sobre a mesma decisão.
//
// Três formas de apresentação, uma superfície só:
//
//   "popover" (padrão) pincel na barra que abre a lista — datasource-manager,
//                      my-workspace, package-developer, meta-project-manager
//   "list"             só a lista, para embutir num painel maior — é o caso do
//                      ecosystem-control-panel, cujo menu de preferências tem
//                      outras coisas acima do tema
//   "cycle"            um botão só, que avança para o próximo tema
//
// Para o menu de contexto da área de trabalho (my-desktop), que precisa dos
// temas como DADO e não como componente, use `BuildThemeMenuItems`.

export type ThemePickerVariant = "popover" | "list" | "cycle"

export type ThemePickerProps = {
    variant?: ThemePickerVariant
    // Controlado: quem manda é o pai (o MPM reconcilia com o tema salvo no
    // servidor). Sem `value`, o componente guarda a escolha sozinho.
    value?: ThemeName
    onChange?: (theme: ThemeName) => void
    // Aplicar o tema no <html>. Desligue só para pré-visualizar sem efeito.
    apply?: boolean
    // Cabeçalho da lista; `null` remove.
    heading?: React.ReactNode
    icon?: string
    label?: string
    align?: "left" | "right"
    // Popover controlado por fora (opcional).
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}

// Os temas como itens de Menu/ContextMenu — mesma decisão, servida como dado.
export const BuildThemeMenuItems = (
    { value, onChange, apply = true }: { value?: ThemeName, onChange?: (theme: ThemeName) => void, apply?: boolean }
): MenuItem[] =>
    THEMES.map(({ key, label, icon }) => ({
        key,
        label,
        icon,
        checked: value === key,
        onSelect: () => { if(apply) ApplyTheme(key); onChange && onChange(key) }
    }))

const ThemePicker = ({
    variant = "popover",
    value,
    onChange,
    apply = true,
    heading = "Tema",
    icon = "paint brush",
    label = "trocar tema",
    align = "right",
    open,
    onOpenChange,
    className = ""
}: ThemePickerProps) => {

    const [ ownTheme, setOwnTheme ] = useState<ThemeName>(() => value || GetSavedTheme())
    const [ ownOpen, setOwnOpen ] = useState(false)

    // Sem `value`, o tema mostrado é o do <html> — e ele pode ser trocado por
    // outro lugar da tela (o menu de contexto da área de trabalho, outro
    // seletor). Sem observar o atributo, a marca de seleção mentiria.
    useEffect(() => {
        if(value !== undefined) return
        const Read = () => {
            const attribute = document.documentElement.getAttribute("data-theme") || "light"
            if(THEMES.some(({ key }) => key === attribute))
                setOwnTheme((current) => current === attribute ? current : attribute as ThemeName)
        }
        Read()
        const observer = new MutationObserver(Read)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: [ "data-theme" ] })
        return () => observer.disconnect()
    }, [ value ])

    const theme     = value !== undefined ? value : ownTheme
    const isOpen    = open !== undefined ? open : ownOpen
    const SetOpen   = (next: boolean) => { onOpenChange ? onOpenChange(next) : setOwnOpen(next) }

    const Pick = (next: ThemeName) => {
        if(apply) ApplyTheme(next)
        if(value === undefined) setOwnTheme(next)
        onChange && onChange(next)
        SetOpen(false)
    }

    const List =
        <div className={`mp-theme-picker ${variant === "list" ? className : ""}`.trim()}>
            { heading !== null &&
                <div className="mp-theme-picker__head">
                    <Icon name={icon}/>
                    <span>{heading}</span>
                </div> }
            {
                THEMES.map((item) =>
                    <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        className={`mp-menu__item ${theme === item.key ? "is-active" : ""}`.trim()}
                        onClick={() => Pick(item.key)}>
                        <Icon name={item.icon}/>
                        <span className="mp-menu__label">{item.label}</span>
                        { theme === item.key && <Icon name="check" tone="success"/> }
                    </button>)
            }
        </div>

    if(variant === "list") return List

    if(variant === "cycle"){
        const index   = Math.max(0, THEMES.findIndex(({ key }) => key === theme))
        const current = THEMES[index]
        const next    = THEMES[(index + 1) % THEMES.length]
        return <IconButton
            className={className}
            icon={current.icon}
            label={`${label} — ${current.label} → ${next.label}`}
            onClick={() => Pick(next.key)}/>
    }

    return <Popover
        className={className}
        open={isOpen}
        align={align}
        onClose={() => SetOpen(false)}
        trigger={<IconButton icon={icon} label={label} onClick={() => SetOpen(!isOpen)}/>}>
        {List}
    </Popover>
}

export default ThemePicker
