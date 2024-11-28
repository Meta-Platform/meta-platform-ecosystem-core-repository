import * as React from "react"

import { 
	Segment, 
	Header,
	Label,
	Divider,
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

const TaskInformation = ({
	taskInformation
}:any) => {


	return <Segment style={{backgroundColor: "#f4f4f4"}}>
                <Header as='h2' textAlign='center'>
                    <Header.Content>
                        Task ID {taskInformation.taskId}
                        <Label color={GetColorByStatus(taskInformation.status)}>{taskInformation.status}</Label>
                        {
                            taskInformation.pTaskId
                            && <Label>Parent Task ID {taskInformation.pTaskId}</Label>
                        }
                        <Header.Subheader>
                            {taskInformation.objectLoaderType}
                        </Header.Subheader>
                    </Header.Content>
                </Header>
                <Segment>
                    <strong style={{ fontSize: "1.2rem" }}>static parameters</strong>
                    <Divider/>
                        {
                            Object.keys(taskInformation.staticParameters)
                            .map((paramName, key) =>
                            <div key={key} style={{marginBottom:"10px"}}>
                                <strong>{paramName}</strong><br/>
                                <span style={{marginLeft:"10px",color:"rgb(98 98 98)"}}>{taskInformation.staticParameters[paramName]}</span>
                            </div>)
                        }
                </Segment>
            </Segment>
}

export default TaskInformation