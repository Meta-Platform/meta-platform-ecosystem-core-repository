
import React from "react"
import { Menu, MenuItem} from "semantic-ui-react"

const SidebarMenu = ({
    onSelectMenu,
    activeItem
}) =>{
    return <Menu pointing secondary vertical style={{width:"auto"}}>
                <MenuItem
                    name='instance supervisor'
                    active={activeItem === 'instance supervisor'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='environments'
                    active={activeItem === 'environments'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='applications and packages'
                    active={activeItem === 'applications and packages'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='repository sources'
                    active={activeItem === 'repository sources'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />

                <MenuItem
                    name='configs'
                    active={activeItem === 'configs'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
            </Menu>
}


export default SidebarMenu