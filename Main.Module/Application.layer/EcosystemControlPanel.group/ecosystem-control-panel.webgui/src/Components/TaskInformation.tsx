import * as React from "react"

import {
	Button,
	Header,
	Icon,
	Label,
	Segment,
	Tab,
	TabPane,
	Table
 } from "semantic-ui-react"

import StatusBadge from "./StatusBadge"
import KeyValuePanel from "./KeyValuePanel"

// Regras (&&) renderizadas na MESMA tabela chave-valor do KeyValuePanel,
// para padronizar a aparência de todas as abas do detalhe.
const RulesTable = ({ rules }:any) => {
	const andRules = (rules && rules["&&"]) || []
	if(andRules.length === 0)
		return <span style={{ color: "#999" }}>sem regras</span>
	return <Table basic compact unstackable style={{ tableLayout: "fixed", width: "100%" }}>
		<Table.Body>
			{
				andRules.map((rule:any, key:number) =>
					<Table.Row key={key}>
						<Table.Cell style={{ width: "45%", verticalAlign: "top", wordBreak: "break-all" }}>
							<strong style={{ fontFamily: "monospace", fontSize: ".82em", color: "#444" }}>{rule.property}</strong>
						</Table.Cell>
						<Table.Cell style={{ overflow: "hidden" }}>
							<code style={{ wordBreak: "break-all" }}>{String(rule["="])}</code>
						</Table.Cell>
					</Table.Row>)
			}
		</Table.Body>
	</Table>
}

const TaskInformation = ({ taskInformation, onClose }:any) => {

	// Cada seção vira uma aba — só aparecem as que têm dados, evitando um
	// painel muito comprido com tudo empilhado.
	const panes:any[] = []
	if(taskInformation.staticParameters)
		panes.push({ menuItem: "params", render: () => <TabPane style={{ border: "none", padding: "8px 2px" }}><KeyValuePanel data={taskInformation.staticParameters}/></TabPane> })
	if(taskInformation.linkedParameters)
		panes.push({ menuItem: "linked", render: () => <TabPane style={{ border: "none", padding: "8px 2px" }}><KeyValuePanel data={taskInformation.linkedParameters}/></TabPane> })
	if(taskInformation.activationRules)
		panes.push({ menuItem: "activation", render: () => <TabPane style={{ border: "none", padding: "8px 2px" }}><RulesTable rules={taskInformation.activationRules}/></TabPane> })
	if(taskInformation.agentLinkRules && taskInformation.agentLinkRules.length > 0)
		panes.push({
			menuItem: "agent links",
			render: () => <TabPane style={{ border: "none", padding: "8px 2px" }}>
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
