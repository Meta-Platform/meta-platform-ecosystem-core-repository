import * as React             from "react"
import {useEffect, useState}  from "react"

import useWebSocket from "../../Hooks/useWebSocket"

import {
	Divider,
	Icon,
	Label,
	Segment,
	Table
 } from "semantic-ui-react"

import StatusBadge from "../../Components/StatusBadge"
import CopyValue   from "../../Components/CopyValue"
import { TruncateMiddle } from "../../Utils/Format"
import { openLogWindow, subscribeLogWindows } from "../../Utils/logWindows"

const GetSocketName = (filePath:string) => {
	if(!filePath) return ""
	const base = filePath.split("/").pop() || filePath
	return base.replace(/\.sock$/, "")
}

const HIGHLIGHT_KEYS = ["executableName", "serverName", "namespace", "package", "port", "uptime"]

const PrimitiveEntries = (obj:any) =>
	Object.keys(obj || {})
		.filter((k) => obj[k] !== undefined && obj[k] !== null && typeof obj[k] !== "object")

// Renderiza o resumo do app (executableName em destaque + alguns campos), sem o
// pid (que tem coluna própria).
const AppInfo = ({ merged }:any) => {
	const exeName = merged && merged.executableName ? String(merged.executableName) : ""
	const otherKeys = merged
		? PrimitiveEntries(merged).filter((k) => HIGHLIGHT_KEYS.includes(k) && k !== "executableName" && String(merged[k]) !== "").slice(0, 2)
		: []
	if(!exeName && otherKeys.length === 0)
		return <span style={{ color: "#bbb", fontSize: ".85em" }}>sem dados do app</span>
	return <span style={{ fontSize: ".85em", color: "#555", display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
		{ exeName && <Label size="mini" color="blue"><Icon name="terminal"/> {exeName}</Label> }
		{
			otherKeys.map((key:string, index:number) => <span key={index}>
				<span style={{ color: "#999" }}>{key}: </span>
				<strong>{String(merged[key])}</strong>
			</span>)
		}
	</span>
}

const SocketRow = ({ supervisorAPI, monitoringStateKey, filePath, status, onSelect, logOpen }:any) => {

	const isConnected = status === "CONNECTED"
	const socketName  = GetSocketName(filePath)

	const [ merged, setMerged ]       = useState<any>(undefined)
	const [ tasks, setTasks ]         = useState<any[]>([])
	const [ isLoading, setIsLoading ] = useState<boolean>(isConnected)

	useEffect(() => {
		if(!isConnected){ setIsLoading(false); return }
		let active = true
		Promise.all([
			supervisorAPI.GetProcessInformation({ monitoringStateKey }).then(({data}:any) => data).catch(() => undefined),
			supervisorAPI.ListInstanceTasks({ monitoringStateKey }).then(({data}:any) => data).catch(() => [])
		]).then(([process, taskList]:any) => {
			if(!active) return
			setMerged({ ...(process || {}) })
			setTasks(taskList || [])
			setIsLoading(false)
		})
		return () => { active = false }
	}, [])

	const pid = merged && (merged.pid ?? merged.PID)

	// info que antes ficava nos chips (Application Instance / Server Manager):
	const _appTask = tasks.find((t:any) => t.objectLoaderType === "application-instance")
	const appNamespace = _appTask && _appTask.staticParameters && _appTask.staticParameters.namespace
	const _svcTask = tasks.find((t:any) => t.objectLoaderType === "service-instance" && t.staticParameters && t.staticParameters.path === "Services/HTTPServer.service")
	const _port = _svcTask && _svcTask.staticParameters && _svcTask.staticParameters.port
	const serverUrl = (_port !== undefined && _port !== null) ? `localhost:${_port}` : undefined

	return <Table.Row style={{ cursor: "pointer", opacity: isConnected ? 1 : 0.78 }} onClick={() => onSelect(monitoringStateKey)}>
		<Table.Cell style={{ overflow: "hidden" }}>
			<Icon name="plug" color={isConnected ? "green" : "red"}/>
			<strong style={{ whiteSpace: "nowrap" }}>{socketName}</strong>
			{ logOpen && <Icon name="terminal" color="blue" className="eco-log-live" style={{ marginLeft: "6px" }} title="log stream ao vivo"/> }
		</Table.Cell>
		<Table.Cell><StatusBadge status={status}/></Table.Cell>
		<Table.Cell style={{ fontFamily: "monospace", color: "#666" }}>
			{ !isConnected ? "—" : (isLoading ? "…" : (pid != null ? String(pid) : "—")) }
		</Table.Cell>
		<Table.Cell style={{ overflow: "hidden" }} title={filePath}>
			<span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
				<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: ".82em", color: "#888" }}>{TruncateMiddle(filePath, 36)}</span>
				<CopyValue value={filePath}/>
			</span>
		</Table.Cell>
		<Table.Cell style={{ overflow: "hidden" }}>
			{
				!isConnected
				? <span style={{ color: "#c0392b", fontSize: ".85em" }}><Icon name="warning circle"/> indisponível</span>
				: isLoading
					? <span style={{ color: "#bbb", fontSize: ".85em" }}>carregando…</span>
					: (appNamespace || serverUrl)
						? <div style={{ fontSize: ".85em", display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden" }}>
							{ appNamespace && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={appNamespace}><Icon name="cube" style={{ color: "#7b8794" }}/> <strong>{appNamespace}</strong></span> }
							{ serverUrl && <span style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={serverUrl}><Icon name="server" style={{ color: "#7b8794" }}/> {TruncateMiddle(serverUrl, 38)}</span> }
						</div>
						: <AppInfo merged={merged}/>
			}
		</Table.Cell>
		<Table.Cell textAlign="right" onClick={(e:any) => e.stopPropagation()}>
			{
				isConnected &&
				<a className="eco-action-link" title={logOpen ? "ver log stream aberto" : "abrir log stream"}
					onClick={() => openLogWindow({ monitoringStateKey, socketName })}
					style={{ color: logOpen ? "#21862e" : "#3a6ea5", cursor: "pointer", marginRight: "8px", fontSize: ".85em", whiteSpace: "nowrap", fontWeight: logOpen ? 600 : 400 }}>
					<Icon name={logOpen ? "eye" : "terminal"}/> {logOpen ? "ver log" : "log"}
				</a>
			}
			<a className="eco-action-link" onClick={() => onSelect(monitoringStateKey)} style={{ color: "#3a6ea5", cursor: "pointer", fontSize: ".85em", whiteSpace: "nowrap" }}>
				inspecionar <Icon name="arrow right"/>
			</a>
		</Table.Cell>
	</Table.Row>
}

const OverviewSocketPanel = ({
	supervisorAPI,
	onSelect
}:any) => {

	const [overview, setOverview] = useState<any>({})
	const [logKeys, setLogKeys]   = useState<string[]>([])

	useEffect(() => { fetchOverview() }, [])
	useEffect(() => subscribeLogWindows((ws:any[]) => setLogKeys(ws.map((w) => w.monitoringStateKey))), [])

	useWebSocket({
		socket          : supervisorAPI.InstanceOverviewChange,
		onMessage       : (newOverview:any) => setOverview(newOverview),
		onConnection    : () => {},
		onDisconnection : () => {}
	})

	const fetchOverview = () =>
		supervisorAPI
		.Overview()
		.then(({data}:any) => setOverview(data))

	const _StatusRank = (status:string) => status === "CONNECTED" ? 0 : (status === "CONNECTING" ? 1 : 2)
	const keys = Object.keys(overview).sort((a, b) => {
		const rank = _StatusRank(overview[a]?.status) - _StatusRank(overview[b]?.status)
		if(rank !== 0) return rank
		return GetSocketName(overview[a]?.filePath).localeCompare(GetSocketName(overview[b]?.filePath))
	})
	const connectedCount = keys.filter((k) => overview[k]?.status === "CONNECTED").length
	const unavailableCount = keys.filter((k) => overview[k]?.status === "UNAVAILABLE").length

	return <Segment style={{ margin: "15px" }}>
		<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
			<h2 style={{ margin: 0, marginRight: "6px" }}><Icon name="server"/> Instances</h2>
			<Label color="green" size="small"><Icon name="check circle"/> {connectedCount} connected</Label>
			{ unavailableCount > 0 && <Label color="red" size="small"><Icon name="warning circle"/> {unavailableCount} unavailable</Label> }
			<Label size="small">{keys.length} sockets</Label>
		</div>
		<Divider/>
		<div style={{ overflowX: "auto" }}>
			<Table selectable striped unstackable style={{ tableLayout: "fixed", width: "100%" }}>
				<Table.Header>
					<Table.Row>
						<Table.HeaderCell width={3}>socket</Table.HeaderCell>
						<Table.HeaderCell width={2}>status</Table.HeaderCell>
						<Table.HeaderCell width={2}>pid</Table.HeaderCell>
						<Table.HeaderCell width={4}>path</Table.HeaderCell>
						<Table.HeaderCell width={3}>app</Table.HeaderCell>
						<Table.HeaderCell width={2}></Table.HeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{
						keys.map((monitoringStateKey:string, key:number) =>
							<SocketRow
								key={key}
								supervisorAPI={supervisorAPI}
								monitoringStateKey={monitoringStateKey}
								filePath={overview[monitoringStateKey].filePath}
								status={overview[monitoringStateKey].status}
								logOpen={logKeys.includes(monitoringStateKey)}
								onSelect={onSelect}/>)
					}
				</Table.Body>
			</Table>
		</div>
	</Segment>
}

export default OverviewSocketPanel
