import * as React from "react"
import { useState } from "react"

import {
	Badge,
	EntityHeader,
	IconButton,
	Tabs
 } from "@i-components"

import KeyValuePanel from "./KeyValuePanel"

// Regras (&&) empilhadas (propriedade ACIMA do valor), padronizadas com o modo
// stacked do KeyValuePanel para otimizar o espaço estreito do off-canvas.
const RulesTable = ({ rules }:any) => {
	const andRules = (rules && rules["&&"]) || []
	if(andRules.length === 0)
		return <span className="ecp-kv__empty">sem regras</span>
	return <div>
		{
			andRules.map((rule:any, key:number) =>
				<div key={key} className={`ecp-rule ${key < andRules.length - 1 ? "has-divider" : ""}`.trim()}>
					<div className="ecp-rule__property">{rule.property}</div>
					<code className="ecp-rule__value">{String(rule["="])}</code>
				</div>)
		}
	</div>
}

const TaskInformation = ({ taskInformation, onClose }:any) => {

	// Cada seção vira uma aba — só aparecem as que têm dados, evitando um
	// painel muito comprido com tudo empilhado. `Tabs` do kit é SÓ A BARRA:
	// o estado da aba ativa e o corpo são responsabilidade daqui.
	const tabs:any[] = []
	const bodyByKey:any = {}

	if(taskInformation.staticParameters){
		tabs.push({ key: "params", label: "params" })
		bodyByKey["params"] = <KeyValuePanel data={taskInformation.staticParameters} stacked/>
	}
	if(taskInformation.linkedParameters){
		tabs.push({ key: "linked", label: "linked" })
		bodyByKey["linked"] = <KeyValuePanel data={taskInformation.linkedParameters} stacked/>
	}
	if(taskInformation.activationRules){
		tabs.push({ key: "activation", label: "activation" })
		bodyByKey["activation"] = <RulesTable rules={taskInformation.activationRules}/>
	}
	if(taskInformation.agentLinkRules && taskInformation.agentLinkRules.length > 0){
		tabs.push({ key: "agent links", label: "agent links" })
		bodyByKey["agent links"] =
			<>
				{
					taskInformation.agentLinkRules.map((linkRule:any, key:number) =>
						<div key={key} className="ecp-agent-link">
							<div className="ecp-agent-link__name">{linkRule.referenceName}</div>
							<RulesTable rules={linkRule.requirement}/>
						</div>)
				}
			</>
	}

	const [ activeTab, setActiveTab ] = useState<string>()
	const currentTab = activeTab && bodyByKey[activeTab] ? activeTab : tabs[0]?.key

	return <div className="ecp-task-information">
		<EntityHeader
			className="ecp-task-information__header"
			icon="tasks"
			title={`Task ${taskInformation.taskId}`}
			status={taskInformation.status}
			subtitle={taskInformation.objectLoaderType}
			badges={ taskInformation.pTaskId !== undefined && taskInformation.pTaskId !== null
				? <Badge>parent {taskInformation.pTaskId}</Badge>
				: undefined }
			actions={ onClose
				? <IconButton icon="close" label="fechar detalhe" size="sm" onClick={onClose}/>
				: undefined }/>

		{
			tabs.length > 0 &&
			<>
				<Tabs
					className="ecp-task-information__tabs"
					tabs={tabs}
					activeKey={currentTab}
					onChange={(key:string) => setActiveTab(key)}/>
				<div className="ecp-task-information__body">
					{ bodyByKey[currentTab] }
				</div>
			</>
		}
	</div>
}

export default TaskInformation
