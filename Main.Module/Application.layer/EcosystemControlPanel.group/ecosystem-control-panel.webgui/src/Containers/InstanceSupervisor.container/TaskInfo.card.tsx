import * as React from "react"
import { Icon } from "semantic-ui-react"

import StatusBadge from "../../Components/StatusBadge"

// Chip compacto de destaque (Application / Server Manager) — ocupa pouca altura.
const TaskInfoCard = ({ data, onSelect }:any) => {
	const { taskId, label, status, icon, info } = data
	return <div
		onClick={() => onSelect && onSelect(taskId)}
		style={{
			display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px",
			border: "1px solid var(--mp-line-faint)", borderRadius: "6px", background: "var(--mp-surface)",
			cursor: onSelect ? "pointer" : "default", minWidth: "240px"
		}}>
		<Icon name={icon} style={{ color: "var(--mp-muted)" }}/>
		<div style={{ flex: 1, minWidth: 0 }}>
			<div style={{ fontWeight: 600, fontSize: ".88em" }}>
				{label} <span style={{ color: "var(--mp-muted-2)", fontWeight: 400 }}>· TID {taskId}</span>
			</div>
			{ info && <div style={{ fontSize: ".8em", color: "var(--mp-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info}</div> }
		</div>
		<StatusBadge status={status}/>
	</div>
}

export default TaskInfoCard
