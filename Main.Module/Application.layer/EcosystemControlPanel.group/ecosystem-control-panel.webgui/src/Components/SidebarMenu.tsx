
import React from "react"
import { Menu, Header, MenuItem} from "semantic-ui-react"

const SidebarMenu = ({
    onSelectMenu,
    activeItem
}) =>{
    return <Menu pointing secondary vertical>
                <MenuItem
                    name='instance monitor'
                    active={activeItem === 'instance monitor'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='applications and repositories'
                    active={activeItem === 'packages'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                <MenuItem
                    name='environments'
                    active={activeItem === 'environments'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
                
                <MenuItem
                    name='sources'
                    active={activeItem === 'repositories'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />

                <MenuItem
                    name='configs'
                    active={activeItem === 'repositories'}
                    onClick={(e, { name }) => onSelectMenu(name)}
                />
            </Menu>
}


export default SidebarMenu