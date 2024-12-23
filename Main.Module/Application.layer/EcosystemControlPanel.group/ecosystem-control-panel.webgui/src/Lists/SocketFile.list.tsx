import * as React from "react"

import { List } from "semantic-ui-react"

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