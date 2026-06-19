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
    showSidebarToggle,
    onToggleSidebar
}) => {
    return <Menu
                borderless
                style={{
                    borderRadius: 0,
                    margin: 0,
                    border: "none",
                    borderBottom: "1px solid #e8e8e8",
                    boxShadow: "0 1px 2px rgba(0,0,0,.06)"
                }}>
                {
                    showSidebarToggle &&
                    <MenuItem onClick={onToggleSidebar} style={{ paddingLeft: "14px", paddingRight: "10px" }}>
                        <Icon name="bars" size="large"/>
                    </MenuItem>
                }
                <MenuItem header>
                    <Icon name="cube" size="large"/>
                    <span style={{ fontWeight: 700, fontSize: "1.05em", marginLeft: "4px" }}>Ecosystem Panel</span>
                </MenuItem>
                <MenuItem>
                    <Button
                        onClick={() => onClickOpenEcosystemDataPathModal()}
                        circular
                        basic
                        icon="folder open"
                        size="mini"
                        title="change ecosystem"
                        style={{ marginRight: "8px" }}/>
                    <code style={{ color: "#666", fontSize: ".85em" }}>{ecosystemdataPath}</code>
                </MenuItem>
                <MenuMenu position="right">
                    <MenuItem onClick={onClickOpenNotificationPanel}>
                        {
                            nUnreadNotifications > 0
                            ? <><Icon name="bell" /><Label color="orange" floating circular size="mini">{nUnreadNotifications}</Label></>
                            : <Icon name="bell outline" />
                        }
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
