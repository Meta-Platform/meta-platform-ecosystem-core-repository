import * as React from "react"

import { 
	Segment, 
	Header,
	Label,
	Divider
 } from "semantic-ui-react"

import StatusBadge from "./StatusBadge"
import KeyValuePanel from "./KeyValuePanel"

const StaticParametersInformation = ({ staticParameters }) => {
    return <Segment>
                <strong style={{ fontSize: "1.1rem" }}>static parameters</strong>
                <Divider/>
                <KeyValuePanel data={staticParameters}/>
            </Segment>
}

const RenderContentRules = ({rules}) => {

    const andRules = (rules && rules["&&"]) || []

    if(andRules.length === 0)
        return <div style={{padding:"15px", backgroundColor: "#f6f7f9", color:"#999"}}>sem regras</div>

    return <div style={{padding:"15px", backgroundColor: "#f6f7f9"}}>
        {
            andRules
            .map((rule:any, key) =>
                <div key={key} style={{marginBottom:"10px", wordBreak:"break-all"}}>
                    <strong>{rule.property} = </strong>{String(rule["="])}
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
                <strong style={{ fontSize: "1.1rem" }}>linked parameters</strong>
                <Divider/>
                <KeyValuePanel data={linkedParameters}/>
            </Segment>
}

const AgentLinkRulesInformation = ({ agentLinkRules }) => {

    return <Segment>
                <strong style={{ fontSize: "1.3rem" }}>agent link rules</strong>
                <Divider/>
                    {
                        agentLinkRules
                        .map((linkRule, key) => 
                            <Segment key={key} style={{marginBottom:"15px", backgroundColor:"#f6f7f9"}}>
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
    
	return <Segment>
                <Header as='h1' textAlign='center'>
                    <Header.Content>
                        Task ID {taskInformation.taskId}
                        <StatusBadge status={taskInformation.status} size="medium"/>
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