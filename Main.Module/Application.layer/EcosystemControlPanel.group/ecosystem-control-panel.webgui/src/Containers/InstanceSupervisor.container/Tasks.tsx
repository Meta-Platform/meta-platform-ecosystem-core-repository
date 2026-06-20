import * as React from "react"
import {
	TabPane,
	Tab
 } from "semantic-ui-react"

import TaskGroupByLoaderContainer from "../../Containers/TaskGroupByLoader.container"

import TaskInformation from "../../Components/TaskInformation"

import TaskCardGroup from "./Task.cardGroup"
import TaskProcessMonitor from "./TaskProcessMonitor"

const Tasks = ({
    taskId,
    instanceTaskList,
    taskInformation,
    onSelectTask,
    onCloseTask
}) => {
	const taskViewPanes = [
		{
			menuItem: 'monitor', render: () =>
			<TabPane style={{background: "#f6f7f8"}}>
				<TaskProcessMonitor
					instanceTaskList={instanceTaskList}
					taskId={taskId}
					onSelectTask={onSelectTask}/>
			</TabPane>
		},
		{
			menuItem: 'group by loader', render: () =>
			<TabPane>
				<TaskGroupByLoaderContainer
					instanceTaskList={instanceTaskList}
					taskId={taskId}
					onSelectTask={onSelectTask}/>
			</TabPane>
		}
	]

	const isDetailOpen = taskId !== undefined && !!taskInformation

	// A tabela ocupa a largura cheia; o detalhe abre como off-canvas (drawer)
	// pela direita, sobrepondo o conteúdo — sem espremer o monitor.
	return <div>
		<TaskCardGroup tasklist={instanceTaskList} onSelectTask={onSelectTask}/>
		<Tab menu={{ secondary: true, pointing: true }} panes={taskViewPanes} />

		{
			isDetailOpen && <>
				<div onClick={onCloseTask}
					style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.28)", zIndex: 1400 }}/>
				<div style={{
					position: "fixed", top: "52px", right: 0, bottom: 0, width: "460px", maxWidth: "94vw",
					zIndex: 1450, background: "#fff", overflow: "auto", boxShadow: "-4px 0 16px rgba(16,24,40,.18)"
				}}>
					<TaskInformation taskInformation={taskInformation} onClose={onCloseTask}/>
				</div>
			</>
		}
	</div>
}

export default Tasks
