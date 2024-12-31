import * as React from "react"
import { Label, Segment } from "semantic-ui-react"
import styled from "styled-components"

const SegmentTaskStyled = styled(Segment)`
    padding-left: 10px !important;
    padding-top: 5px !important;
    padding-bottom: 5px !important;
    margin: 5px !important;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: ${({ isSelected }) =>
        isSelected ? "antiquewhite" : "white"} !important;
    border: ${({ isSelected }) =>
        isSelected ? "1px solid rgb(34 36 38 / 66%)" : "1px solid #afafaf"} !important;

    &:hover {
        background-color: antiquewhite !important;
        border: 1px solid rgb(34 36 38 / 66%) !important;
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

const RenderItemTitle = ({
	objectLoaderType,
	staticParameters
}) => {
	switch(objectLoaderType){
		case "install-nodejs-package-dependencies":
		case "application-instance":
			return <span style={{color:"#100085"}}> | <strong>namespace</strong> {staticParameters.namespace}</span>
		case "service-instance":
		case "nodejs-package":
			return <span style={{color:"#100085"}}> | <strong>tag</strong> {staticParameters.tag}</span>
		case "endpoint-instance":
			return <span style={{color:"#100085"}}> | <strong>url</strong> {staticParameters.url}</span>
	}
}

const TaskItem = ({
    task,
	taskId,
    onShowTaskDetails,
	showObjectLoaderType=true
}) => {
    return (
        <SegmentTaskStyled 
			isSelected={task.taskId === taskId}
			onClick={() => onShowTaskDetails(task.taskId)} style={{ backgroundColor: "#f4f4f4" }}>
            <div>
                <span>
                    <strong> TID {task.taskId}</strong>
                    {task.pTaskId && <> | <i>PTID {task.pTaskId}</i></>}
					<RenderItemTitle
						objectLoaderType={task.objectLoaderType}
						staticParameters={task.staticParameters}
						/>
				</span>
            </div>
			<div>
				{showObjectLoaderType && <Label size="mini" color="grey">{task.objectLoaderType}</Label>}
				<Label size="mini" color={GetColorByStatus(task.status)}>{task.status}</Label>
			</div>
        </SegmentTaskStyled>
    )
}

export default TaskItem
