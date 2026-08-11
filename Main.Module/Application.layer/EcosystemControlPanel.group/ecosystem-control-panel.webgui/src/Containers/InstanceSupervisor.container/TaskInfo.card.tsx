import * as React from "react"

import { ObjectCard, StatusBadge } from "@i-components"

// Chip compacto de destaque (Application / Server Manager) — ocupa pouca altura.
const TaskInfoCard = ({ data, onSelect }:any) => {
	const { taskId, label, status, icon, info } = data
	return <ObjectCard
		className="ecp-taskinfo-card"
		icon={icon}
		title={<>{label} <span className="ecp-taskinfo-card__tid">· TID {taskId}</span></>}
		meta={info}
		status={<StatusBadge status={status}/>}
		onClick={onSelect ? () => onSelect(taskId) : undefined}/>
}

export default TaskInfoCard
