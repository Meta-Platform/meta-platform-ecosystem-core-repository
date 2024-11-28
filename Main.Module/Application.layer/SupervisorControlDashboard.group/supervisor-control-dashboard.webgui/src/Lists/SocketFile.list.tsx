
import * as React from "react"

import {
	List, 
	Image, 
	Button, 
	Icon
} from "semantic-ui-react"
import styled from "styled-components"

const ListStyled = styled(List)`
	overflow: scroll;
    height: 87vh;
`

type SocketFileListProps =
{
	list:Array<string>
	socketFileSelected?:string
	onSelect?:Function
}

const SocketFileList = ({
	list, 
	socketFileSelected, 
	onSelect
}:SocketFileListProps) => 
	<List selection animated>
		{
			list
			.map((socketFileName:string, key:number) => 
			<List.Item 
				key={key} 
				active={socketFileSelected && socketFileName === socketFileSelected}
				onClick={() => onSelect(socketFileName)} >
				<List.Content>
					<List.Header>{socketFileName}</List.Header>
				</List.Content>
			</List.Item>)
		}
	</List>


export default SocketFileList