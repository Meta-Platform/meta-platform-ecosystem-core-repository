import * as React from "react"

import {
	Button,
	Header,
	Icon,
	Label,
	Segment,
	Tab,
	TabPane
 } from "semantic-ui-react"

import StatusBadge from "./StatusBadge"
import KeyValuePanel from "./KeyValuePanel"

// Regras (&&) empilhadas (propriedade ACIMA do valor), padronizadas com o modo
// stacked do KeyValuePanel para otimizar o espaço estreito do off-canvas.
const RulesTable = ({ rules }:any) => {
	const andRules = (rules && rules["&&"]) || []
	if(andRules.length === 0)
		return <span style={{ color: "#999" }}>sem regras</span>
	return <div>
		{
			andRules.map((rule:any, key:number) =>
				<div key={key} style={{ padding: "8px 0", borderBottom: key < andRules.length - 1 ? "1px solid #d7dce1" : "none" }}>
					<div style={{ fontFamily: "monospace", fontSize: ".78em", color: "#8a9099", fontWeight: 600, marginBottom: "2px", wordBreak: "break-all" }}>{rule.property}</div>
					<code style={{ wordBreak: "break-all" }}>{String(rule["="])}</code>
				</div>)
		}
	</div>
}

const TaskInformation = ({ taskInformation, onClose }:any) => {

	// Cada seção vira uma aba — só aparecem as que têm dados, evitando um
	// painel muito comprido com tudo empilhado.
	const panes:any[] = []
	if(taskInformation.staticParameters)
		panes.push({ menuItem: "params", render: () => <TabPane style={{ border: "none", padding: "10px 14px" }}><KeyValuePanel data={taskInformation.staticParameters} stacked/></TabPane> })
	if(taskInformation.linkedParameters)
		panes.push({ menuItem: "linked", render: () => <TabPane style={{ border: "none", padding: "10px 14px" }}><KeyValuePanel data={taskInformation.linkedParameters} stacked/></TabPane> })
	if(taskInformation.activationRules)
		panes.push({ menuItem: "activation", render: () => <TabPane style={{ border: "none", padding: "10px 14px" }}><RulesTable rules={taskInformation.activationRules}/></TabPane> })
	if(taskInformation.agentLinkRules && taskInformation.agentLinkRules.length > 0)
		panes.push({
			menuItem: "agent links",
			render: () => <TabPane style={{ border: "none", padding: "10px 14px" }}>
				{
					taskInformation.agentLinkRules.map((linkRule:any, key:number) =>
						<div key={key} style={{ marginBottom: "10px" }}>
							<div style={{ fontFamily: "monospace", fontSize: ".82em", marginBottom: "4px" }}>{linkRule.referenceName}</div>
							<RulesTable rules={linkRule.requirement}/>
						</div>)
				}
			</TabPane>
		})

	return <div style={{ padding: "14px 16px" }}>
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
			<Header as="h3" style={{ margin: 0 }}>
				<Header.Content>
					Task ID {taskInformation.taskId}
					<StatusBadge status={taskInformation.status} size="small"/>
					{ taskInformation.pTaskId !== undefined && taskInformation.pTaskId !== null &&
						<Label size="mini" style={{ marginLeft: "4px" }}>parent {taskInformation.pTaskId}</Label> }
					<Header.Subheader>{taskInformation.objectLoaderType}</Header.Subheader>
				</Header.Content>
			</Header>
			{ onClose && <Button icon basic size="mini" title="fechar detalhe" onClick={onClose} style={{ flex: "0 0 auto" }}><Icon name="close"/></Button> }
		</div>

		{
			panes.length > 0 &&
			<Tab
				menu={{ secondary: true, pointing: true, size: "small" }}
				panes={panes}
				style={{ marginTop: "10px" }}/>
		}
	</div>
}

export default TaskInformation
