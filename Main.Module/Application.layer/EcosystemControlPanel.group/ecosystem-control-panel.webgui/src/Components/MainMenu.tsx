import * as React from "react"
import { useState } from "react"
import {
    Topbar,
    Icon,
    IconButton,
    Popover,
    ThemePicker
} from "@i-components"

// TopBar do shell (§3 do guia): marca à esquerda, breadcrumb da seção ativa e
// chip do workspace no centro, notificações e preferências à direita.
// A moldura é o `Topbar` do kit; só o conteúdo dos slots é deste painel.
const MainMenu = ({
    nUnreadNotifications,
    ecosystemdataPath,
    activePanelTitle,
    activePanelIcon,
    onClickOpenEcosystemDataPathModal,
    onClickOpenNotificationPanel,
    onClickLogo,
    showSidebarToggle,
    onToggleSidebar
}) => {

    const [ isPreferencesOpen, setIsPreferencesOpen ] = useState(false)

    return <Topbar
        className="ecp-topbar"
        brand={
            <span className="ecp-topbar__brand">
                {
                    showSidebarToggle &&
                    <IconButton icon="bars" label="toggle navigator" size="sm" onClick={onToggleSidebar}/>
                }
                <button
                    type="button"
                    className="ecp-topbar__logo"
                    title="home"
                    disabled={!onClickLogo}
                    onClick={() => onClickLogo && onClickLogo()}>
                    <Icon name="cube"/>
                    <span>Ecosystem Panel</span>
                </button>
            </span>
        }
        right={<>
            <span className="ecp-topbar__bell">
                <IconButton
                    icon={nUnreadNotifications > 0 ? "bell" : "bell outline"}
                    label="notifications"
                    onClick={onClickOpenNotificationPanel}/>
                {
                    nUnreadNotifications > 0 &&
                    <span className="ecp-topbar__badge">{nUnreadNotifications}</span>
                }
            </span>

            <Popover
                open={isPreferencesOpen}
                align="right"
                onClose={() => setIsPreferencesOpen(false)}
                trigger={
                    <IconButton
                        icon="sliders horizontal"
                        label="preferences"
                        onClick={() => setIsPreferencesOpen(!isPreferencesOpen)}/>
                }>
                {/* O `Menu` do kit traz moldura própria (borda + sombra) e, dentro
                    do painel do Popover, ela duplicaria a caixa. Aqui as linhas
                    usam a classe .mp-menu__item do próprio kit, sem a moldura. */}
                <span className="ecp-topbar__menu">
                    <button
                        type="button"
                        className="mp-menu__item"
                        onClick={() => { setIsPreferencesOpen(false); onClickOpenEcosystemDataPathModal() }}>
                        <Icon name="folder open"/>
                        <span className="mp-menu__label">change ecosystem</span>
                    </button>

                    <span className="mp-menu__sep"/>

                    {/* A lista de temas é a variante "list" do ThemePicker do
                        kit: feita exatamente para embutir num painel maior, que
                        é o caso deste menu de preferências. */}
                    <ThemePicker
                        variant="list"
                        heading="Theme"
                        onChange={() => setIsPreferencesOpen(false)}/>
                </span>
            </Popover>
        </>}>

        {
            /* título da seção ativa — trazido dos cabeçalhos dos cards para
               cá, para não desperdiçar espaço vertical nos painéis. */
            activePanelTitle &&
            <span className="ecp-topbar__section">
                <Icon name="angle right" tone="muted"/>
                { activePanelIcon && <Icon name={activePanelIcon} tone="info"/> }
                <strong>{activePanelTitle}</strong>
            </span>
        }

        <span className="ecp-topbar__path">
            <IconButton
                icon="folder open"
                label="change ecosystem"
                size="sm"
                onClick={() => onClickOpenEcosystemDataPathModal()}/>
            <code className="ecp-mono ecp-topbar__path-value" title={ecosystemdataPath}>{ecosystemdataPath}</code>
        </span>
    </Topbar>
}

export default MainMenu
