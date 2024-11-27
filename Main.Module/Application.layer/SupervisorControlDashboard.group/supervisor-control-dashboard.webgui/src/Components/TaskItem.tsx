import * as React from "react"
import { Label, Segment } from "semantic-ui-react"
import styled from "styled-components"

const SegmentTaskStyled = styled(Segment)`
    padding-left: 10px !important;
    padding-top: 5px !important;
    padding-bottom: 5px !important;
    margin: 10px !important;
    box-shadow: 1px 1px 4px 0 rgb(34 36 38 / 71%) !important;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
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


const TaskInfoContainer = styled.div`
    display: flex;
    flex-direction: column;
`

const TaskItem = ({
    index,
    task,
    onShowTaskDetails
}) => {
    return (
        <SegmentTaskStyled onClick={() => onShowTaskDetails(task.taskId)} style={{ backgroundColor: "#f4f4f4" }}>
            <div>
                <span style={{ fontSize: "1.2rem" }}>
                    <strong> TID {task.taskId}</strong>
                    {task.pTaskId && <> | <i>PTID {task.pTaskId}</i></>}
					<RenderItemTitle
						objectLoaderType={task.objectLoaderType}
						staticParameters={task.staticParameters}
						/>
				</span>
            </div>
			<div>
				<Label color="grey">{task.objectLoaderType}</Label>
				<Label color={GetColorByStatus(task.status)}>{task.status}</Label>
			</div>
        </SegmentTaskStyled>
    )
}

export default TaskItem
