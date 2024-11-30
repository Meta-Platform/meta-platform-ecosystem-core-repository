import * as React from "react"
import { 
	Menu,
	Header,
    MenuMenu,
    MenuItem,
    Icon
} from "semantic-ui-react"
import styled from "styled-components"

const AppsMenuItem = styled(Menu.Item)`
	padding: 8px!important;
`
const MainMenu = () => {

    return <Menu attached="top">
                <AppsMenuItem active>
                    <Header>Instance Supervisor</Header>
                </AppsMenuItem>
                <AppsMenuItem >
                    <Icon name='folder open' />
                    /home/kadisk/Workspaces/meta-platform-repo/EcosystemData/supervisor-sockets
                </AppsMenuItem>
                <MenuMenu position='right'>
                    <MenuItem>
                        <Icon name='calendar' />
                    </MenuItem>
                </MenuMenu>
            </Menu>
}

export default MainMenu