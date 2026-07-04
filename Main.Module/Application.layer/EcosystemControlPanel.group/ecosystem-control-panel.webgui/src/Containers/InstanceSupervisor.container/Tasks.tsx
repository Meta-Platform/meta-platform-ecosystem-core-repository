import * as React from "react"

import TaskInformation from "../../Components/TaskInformation"

import TaskProcessMonitor from "./TaskProcessMonitor"

const Tasks = ({
    taskId,
    instanceTaskList,
    taskInformation,
    onSelectTask,
    onCloseTask,
    taskFilter = ""
}) => {

	const isDetailOpen = taskId !== undefined && !!taskInformation

	// Visão única: a lista de tasks (flat), preenchendo a altura da janela. O
	// detalhe abre como off-canvas (drawer) pela direita.
	return <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
		<TaskProcessMonitor
			instanceTaskList={instanceTaskList}
			taskId={taskId}
			filterValue={taskFilter}
			onSelectTask={onSelectTask}/>

		{
			isDetailOpen && <>
				<div className="mp-offcanvas__scrim" onClick={onCloseTask} style={{ zIndex: 1400 }}/>
				<div className="mp-offcanvas" style={{ width: "720px", maxWidth: "94vw", zIndex: 1450 }}>
					<TaskInformation taskInformation={taskInformation} onClose={onCloseTask}/>
				</div>
			</>
		}
	</div>
}

export default Tasks
