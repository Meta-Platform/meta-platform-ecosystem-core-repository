import * as React from "react"
import { 
	Menu,
	Header
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
                    /home/kadisk/Workspaces/meta-platform-repo/EcosystemData/supervisor-sockets
                </AppsMenuItem>
            </Menu>
}

export default MainMenu