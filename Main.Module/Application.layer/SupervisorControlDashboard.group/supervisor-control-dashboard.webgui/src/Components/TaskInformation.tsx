import * as React from "react"

import { 
	Segment, 
	Header,
	Label,
	Divider,
    ListItem,
    ListHeader,
    ListDescription,
    ListContent,
    List
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

const RenderValue = ({value}) => {

    if(!value) return "UNDEFINED"

    if(typeof value === "string")
        return <div style={{ marginLeft:"10px", color:"rgb(98 98 98)", backgroundColor: "#e8e8e8", padding:"10px" }}>{value}</div>

    if(Array.isArray(value))
        return  <List divided relaxed style={{ margin:"0px 15px 0px 15px", backgroundColor: "#e8e8e8", color:"rgb(98 98 98)", padding:"10px" }}>
                    {
                        Object.keys(value)
                        .map((property) => 
                            <ListItem>
                                <ListContent>{value[property]}</ListContent>
                            </ListItem>)
                    }
                </List>

    if(typeof value === "object")
        return  <List divided relaxed style={{ margin:"0px 15px 0px 15px", backgroundColor: "#e8e8e8", color:"rgb(98 98 98)", padding:"10px" }}>
                    {
                        Object.keys(value)
                        .map((property) => 
                            <ListItem>
                                <ListContent>
                                    <ListHeader style={{ color:"rgb(98 98 98)" }}>{property}</ListHeader>
                                    <ListDescription style={{ color:"rgb(98 98 98)" }}>{value[property]}</ListDescription>
                                </ListContent>
                            </ListItem>)
                    }
                </List>
    

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
                                <strong>{paramName}</strong>
                                <RenderValue value={taskInformation.staticParameters[paramName]}/>
                            </div>)
                        }
                </Segment>
            </Segment>
}

export default TaskInformation