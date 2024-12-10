import * as React from "react"
import { 
	Menu,
	Header,
    MenuMenu,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    Button
} from "semantic-ui-react"

const MainMenu = ({
    ecosystemdataPath,
    onClickOpenEcosystemDataPathModal
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
                    <Dropdown item icon='sliders horizontal' simple>
                        <DropdownMenu>
                            <DropdownItem icon='folder open' text='change ecosystem' />
                        </DropdownMenu>
                    </Dropdown>
                </MenuMenu>
            </Menu>
}

export default MainMenu