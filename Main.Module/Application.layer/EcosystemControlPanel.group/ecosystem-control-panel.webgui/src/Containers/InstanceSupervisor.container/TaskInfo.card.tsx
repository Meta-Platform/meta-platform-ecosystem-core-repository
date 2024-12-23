import * as React from "react"

import { 
	Label,
	Card,
	CardContent,
	CardHeader,
	CardMeta,
	CardDescription
 } from "semantic-ui-react"


const GetColorByStatus = (status) => {
	switch(status){
		case "ACTIVE":
			return "green"
		case "FAILURE":
			return "red"
		case "STARTING":
			return "blue"
		case "AWAITING_PRECONDITIONS":
			return "teal"
		default:
			return "orange"
	}
}

const TaskInfoCard = ({data}) => {

	const {
		taskId,
		label,
		status,
		descriptionContent
	} = data 
	return <Card>
				<CardContent>
					<CardHeader>{label}</CardHeader>
					<CardMeta><Label size="mini" color={GetColorByStatus(status)} style={{"marginRight":"5px"}}>{status}</Label>Task ID {taskId}</CardMeta>
					<CardDescription>{descriptionContent}</CardDescription>
				</CardContent>
			</Card>
}

export default TaskInfoCard