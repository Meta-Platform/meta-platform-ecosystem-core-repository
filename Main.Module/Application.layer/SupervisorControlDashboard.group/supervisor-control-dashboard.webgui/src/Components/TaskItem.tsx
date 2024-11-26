import * as React from "react"

import { Label, Segment, Header } from 'semantic-ui-react'

import styled from "styled-components"

const SegmentTaskStyled = styled(Segment)`
    padding-left: 10px!important;
    padding-top: 5px!important;
    padding-bottom: 5px!important;
    margin: 5px!important;
    box-shadow: 1px 1px 4px 0 rgb(34 36 38 / 71%)!important;
    cursor: pointer;
    &:hover {
        background-color: antiquewhite!important;
        border: 1px solid rgb(34 36 38 / 66%)!important;
    }
`
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

const TaskItem = ({
	index,
	task,
	onShowTaskDetails
}) => {

	return <SegmentTaskStyled onClick={() => onShowTaskDetails(task.taskId)} style={index % 2===1 ? {backgroundColor: "#f4f4f4"} : {}}>
				<strong>Task ID {task.taskId}</strong> | {task.objectLoaderType}{" "}
				{task.pTaskId && <Label style={{marginRight: "5px"}}>Parent Task ID {task.pTaskId}</Label>}
				<Label size="mini" color={GetColorByStatus(task.status)} style={{marginRight: "5px"}}>{task.status}</Label>
				{/*
					Object.keys(task.staticParameters)
					.map((paramName) => {
						return <Label size="mini" style={{marginRight: "5px"}}>{paramName}</Label>
					})
				*/}
				
			</SegmentTaskStyled>
}

export default TaskItem