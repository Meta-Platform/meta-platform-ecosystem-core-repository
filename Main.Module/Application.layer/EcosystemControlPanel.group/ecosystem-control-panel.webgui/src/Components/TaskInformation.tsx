import * as React from "react"

import { 
	Segment, 
	Header,
	Label,
	Divider
 } from "semantic-ui-react"

import RenderValue from "./RenderValue"

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

const StaticParametersInformation = ({ staticParameters }) => {
    return <Segment>
                <strong style={{ fontSize: "1.3rem" }}>static parameters</strong>
                <Divider/>
                    {
                        Object.keys(staticParameters)
                        .map((paramName, key) =>
                        <div key={key} style={{marginBottom:"10px"}}>
                            <strong>{paramName}</strong>
                            <RenderValue value={staticParameters[paramName]}/>
                        </div>)
                    }
            </Segment>
}

const RenderContentRules = ({rules}) => {

    const andRules = rules["&&"]

    return <div style={{padding:"15px", backgroundColor: "antiquewhite"}}>
        {
            andRules
            .map((rule:any, key) => 
                <div key={key} style={{marginBottom:"10px"}}>
                    <strong>{rule.property} = </strong>{rule["="]}
                    {
                        key < andRules.length - 1
                        && <Divider horizontal>and</Divider>
                    }
                </div>
                )
        }
    </div>
}

const ActivationRulesInformation = ({ activationRules }) => {
    return <Segment>
                <strong style={{ fontSize: "1.3rem" }}>activation rules</strong>
                <Divider/>
                <RenderContentRules rules={activationRules}/>
            </Segment>
}


const LinkedParametersInformation = ({ linkedParameters }) => {

    return <Segment>
                <strong style={{ fontSize: "1.3rem" }}>linked parameters</strong>
                <Divider/>
                    {
                        Object.keys(linkedParameters)
                        .map((paramName, key) => 
                            <div key={key} style={{marginBottom:"10px"}}>
                                <strong>{paramName}</strong>
                                <RenderValue value={linkedParameters[paramName]}/>
                            </div>)
                    }
            </Segment>
}

const AgentLinkRulesInformation = ({ agentLinkRules }) => {

    return <Segment>
                <strong style={{ fontSize: "1.3rem" }}>agent link rules</strong>
                <Divider/>
                    {
                        agentLinkRules
                        .map((linkRule, key) => 
                            <Segment key={key} style={{marginBottom:"15px", backgroundColor:"aliceblue"}}>
                                <strong>{linkRule.referenceName}</strong>
                                <Divider/>
                                <RenderContentRules rules={linkRule.requirement}/>
                            </Segment>)
                    }
            </Segment>
}



const TaskInformation = ({
	taskInformation
}:any) => {
    
	return <Segment style={{backgroundColor: "#f4f4f4"}}>
                <Header as='h1' textAlign='center'>
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
                {
                    taskInformation.activationRules
                    && <ActivationRulesInformation
                            activationRules={taskInformation.activationRules} />
                }
                {
                    taskInformation.staticParameters
                    && <StaticParametersInformation
                            staticParameters={taskInformation.staticParameters} />
                }
                {
                    taskInformation.linkedParameters
                    && <LinkedParametersInformation
                            linkedParameters={taskInformation.linkedParameters} />
                }
                {
                    taskInformation.agentLinkRules
                    && taskInformation.agentLinkRules.length > 0
                    && <AgentLinkRulesInformation
                        agentLinkRules={taskInformation.agentLinkRules} />
                }
            </Segment>
}

export default TaskInformation