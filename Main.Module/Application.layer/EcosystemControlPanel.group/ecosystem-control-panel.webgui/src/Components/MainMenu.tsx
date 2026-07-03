import * as React from "react"
import {
	Menu,
	MenuMenu,
	MenuItem,
	Dropdown,
	DropdownMenu,
	DropdownItem,
	Button,
	Icon,
	Label
} from "semantic-ui-react"

// Top bar harmônica com a sidebar (EcosystemNavigator): mesma marca (ícone
// cubo + "Ecosystem"), paleta neutra, borda sutil, sem realces pesados.
const MainMenu = ({
    nUnreadNotifications,
    ecosystemdataPath,
    onClickOpenEcosystemDataPathModal,
    onClickOpenNotificationPanel,
    onClickLogo,
    showSidebarToggle,
    onToggleSidebar
}) => {
    return <Menu
                className="eco-main-menu"
                borderless
                style={{
                    borderRadius: 0,
                    margin: 0,
                    border: "none",
                    borderBottom: "1px solid #e8e8e8",
                    boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                    minHeight: "var(--eco-topbar-height)"
                }}>
                {
                    showSidebarToggle &&
                    <MenuItem onClick={onToggleSidebar} style={{ paddingLeft: "14px", paddingRight: "10px" }}>
                        <Icon name="bars" size="large"/>
                    </MenuItem>
                }
                <MenuItem header onClick={() => onClickLogo && onClickLogo()} style={{ cursor: onClickLogo ? "pointer" : undefined }} title="início">
                    <Icon name="cube" size="large"/>
                    <span className="eco-main-menu-title">Ecosystem Panel</span>
                </MenuItem>
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
                        </DropdownMenu>
                    </Dropdown>
                </MenuMenu>
            </Menu>
}

export default MainMenu
