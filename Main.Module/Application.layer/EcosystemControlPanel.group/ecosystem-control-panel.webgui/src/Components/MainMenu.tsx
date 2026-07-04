import * as React from "react"
import { useState } from "react"
import {
	Menu,
	MenuMenu,
	MenuItem,
	Dropdown,
	DropdownMenu,
	DropdownItem,
	DropdownDivider,
	DropdownHeader,
	Button,
	Icon,
	Label
} from "semantic-ui-react"

import { THEMES, ApplyTheme, GetSavedTheme, ThemeName } from "../Utils/theme"

// Top bar harmônica com a sidebar (EcosystemNavigator): mesma marca (ícone
// cubo + "Ecosystem"), paleta neutra, borda sutil, sem realces pesados.
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
    const [ theme, setTheme ] = useState<ThemeName>(GetSavedTheme())
    const selectTheme = (t:ThemeName) => { setTheme(t); ApplyTheme(t) }
    return <Menu
                className="eco-main-menu"
                borderless
                style={{
                    borderRadius: 0,
                    margin: 0,
                    minHeight: "var(--mp-shell-topbar-h)"
                }}>
                {
                    showSidebarToggle &&
                    <MenuItem onClick={onToggleSidebar} style={{ paddingLeft: "14px", paddingRight: "10px" }}>
                        <Icon name="bars" size="large"/>
                    </MenuItem>
                }
                <MenuItem header onClick={() => onClickLogo && onClickLogo()} style={{ cursor: onClickLogo ? "pointer" : undefined }} title="home">
                    <Icon name="cube" size="large"/>
                    <span className="eco-main-menu-title">Ecosystem Panel</span>
                </MenuItem>
                {
                    /* título da seção ativa — trazido dos cabeçalhos dos cards para
                       cá, para não desperdiçar espaço vertical nos painéis. */
                    activePanelTitle &&
                    <MenuItem className="eco-main-menu-section">
                        <Icon name="angle right" style={{ color: "var(--mp-line-soft)", margin: "0 2px 0 0" }}/>
                        { activePanelIcon && <Icon name={activePanelIcon} style={{ color: "var(--mp-accent-blue)", margin: "0 6px 0 0" }}/> }
                        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{activePanelTitle}</span>
                    </MenuItem>
                }
                <MenuItem className="eco-main-menu-path">
                    <Button
                        onClick={() => onClickOpenEcosystemDataPathModal()}
                        circular
                        basic
                        icon="folder open"
                        size="mini"
                        title="change ecosystem"
                        style={{ marginRight: "8px" }}/>
                    <code title={ecosystemdataPath}>{ecosystemdataPath}</code>
                </MenuItem>
                <MenuMenu position="right">
                    <MenuItem onClick={onClickOpenNotificationPanel}>
                        <span className="eco-notification-button">
                            <Icon name={nUnreadNotifications > 0 ? "bell" : "bell outline"} />
                            {
                                nUnreadNotifications > 0 &&
                                <Label color="orange" circular size="mini" className="eco-notification-badge">
                                    {nUnreadNotifications}
                                </Label>
                            }
                        </span>
                    </MenuItem>
                    <Dropdown item icon="sliders horizontal" simple>
                        <DropdownMenu>
                            <DropdownItem icon="folder open" text="change ecosystem" onClick={() => onClickOpenEcosystemDataPathModal()}/>
                            <DropdownDivider/>
                            <DropdownHeader icon="paint brush" content="Theme"/>
                            {
                                THEMES.map((t) =>
                                    <DropdownItem key={t.key} onClick={() => selectTheme(t.key)} active={theme === t.key}>
                                        <Icon name={t.icon as any}/> {t.label}
                                        { theme === t.key && <Icon name="check" style={{ float: "right", margin: 0 }}/> }
                                    </DropdownItem>)
                            }
                        </DropdownMenu>
                    </Dropdown>
                </MenuMenu>
            </Menu>
}

export default MainMenu
