import * as React from "react"
import { 
	Menu,
	Header,
    MenuMenu,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    Button,
    Icon,
    Label
} from "semantic-ui-react"

const MainMenu = ({
    nUnreadNotifications,
    ecosystemdataPath,
    onClickOpenEcosystemDataPathModal,
    onClickOpenNotificationPanel
}) => {
    return <Menu attached="top">
                <Menu.Item active>
                    <Header >Ecosystem Panel</Header>
                </Menu.Item>
                <Menu.Item >
                    <Button 
                        onClick={() => onClickOpenEcosystemDataPathModal()}
                        circular 
                        icon='folder open' 
                        size="mini" 
                        style={{fontSize: ".7em", "marginRight": "5px"}}/>
                    {ecosystemdataPath}
                </Menu.Item>
                <MenuMenu position='right'>
                    <Menu.Item position='right' onClick={onClickOpenNotificationPanel}>

                        {
                            nUnreadNotifications > 0
                            ? <Label color='orange'>
                                    <Icon name='bell' size="large" /> {nUnreadNotifications}
                                </Label>
                            : <Icon name='bell' size="large" />
                        }
                    </Menu.Item>
                    <Dropdown item icon='sliders horizontal' simple>
                        <DropdownMenu>
                            <DropdownItem icon='folder open' text='change ecosystem' />
                        </DropdownMenu>
                    </Dropdown>
                </MenuMenu>
            </Menu>
}

export default MainMenu