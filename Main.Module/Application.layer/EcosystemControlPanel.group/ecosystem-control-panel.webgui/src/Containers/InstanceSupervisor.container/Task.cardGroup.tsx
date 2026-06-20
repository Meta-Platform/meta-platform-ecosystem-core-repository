import * as React from "react"

import TaskInfoCard from "./TaskInfo.card"

// Faixa compacta com os destaques da instância (Application Instance e Server
// Manager Service), ocupando pouca altura acima do monitor de tasks.
const TaskCardGroup = ({ tasklist, onSelectTask }:any) => {

	const _GetApplicationInstanceCardData = () => {
		const data = tasklist.find(({objectLoaderType}:any) => objectLoaderType === "application-instance")
		if(!data) return undefined
		return {
			taskId: data.taskId,
			label: "Application Instance",
			status: data.status,
			icon: "cube",
			info: data.staticParameters?.namespace
		}
	}

	const _GetServerManagerCardData = () => {
		const data = tasklist.find(({objectLoaderType, staticParameters}:any) =>
			objectLoaderType === "service-instance" && staticParameters?.path === "Services/HTTPServer.service")
		if(!data) return undefined
		const port = data.staticParameters?.port
		const url = isNaN(port) ? port : `localhost:${port}`
		return {
			taskId: data.taskId,
			label: "Server Manager",
			status: data.status,
			icon: "server",
			info: `${data.staticParameters?.name || ""}${url ? ` · ${url}` : ""}`
		}
	}

	const cards = [ _GetApplicationInstanceCardData(), _GetServerManagerCardData() ].filter(Boolean)
	if(cards.length === 0) return null

	return <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
		{ cards.map((data:any, key:number) => <TaskInfoCard key={key} data={data} onSelect={onSelectTask}/>) }
	</div>
}

export default TaskCardGroup
