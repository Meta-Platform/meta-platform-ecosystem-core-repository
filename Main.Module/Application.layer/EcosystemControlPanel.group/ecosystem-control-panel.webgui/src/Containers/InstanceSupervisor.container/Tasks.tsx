import * as React from "react"

import TaskInformation from "../../Components/TaskInformation"

import TaskProcessMonitor from "./TaskProcessMonitor"

const Tasks = ({
    taskId,
    instanceTaskList,
    taskInformation,
    onSelectTask,
    onCloseTask
}) => {

	const isDetailOpen = taskId !== undefined && !!taskInformation

	// Visão única (sem tabs): a lista de tasks com modos lista/hierarquia/loader.
	// O detalhe abre como off-canvas (drawer) pela direita.
	return <div>
		<TaskProcessMonitor
			instanceTaskList={instanceTaskList}
			taskId={taskId}
			onSelectTask={onSelectTask}/>

		{
			isDetailOpen && <>
				<div onClick={onCloseTask}
					style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.28)", zIndex: 1400 }}/>
				<div style={{
					position: "fixed", top: "52px", right: 0, bottom: 0, width: "780px", maxWidth: "94vw",
					zIndex: 1450, background: "#fff", overflow: "auto", boxShadow: "-4px 0 16px rgba(16,24,40,.18)"
				}}>
					<TaskInformation taskInformation={taskInformation} onClose={onCloseTask}/>
				</div>
			</>
		}
	</div>
}

export default Tasks
