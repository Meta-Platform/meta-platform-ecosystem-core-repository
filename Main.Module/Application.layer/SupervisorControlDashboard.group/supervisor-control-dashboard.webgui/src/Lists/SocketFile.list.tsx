import * as React from "react"

import {
	List,
	Label
} from "semantic-ui-react"

const GetColorByInstanceStatus = (status) => {
	switch(status){
		case "RUNNING":
			return "green"
		case "ERROR":
			return "red"
		case "STARTING":
			return "teal"
		default:
			return "orange"
	}
}

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
					<List.Header><Label size="mini" horizontal color={GetColorByInstanceStatus(undefined)}>{undefined}</Label>{socketFileName}</List.Header>
				</List.Content>
			</List.Item>)
		}
	</List>


export default SocketFileList