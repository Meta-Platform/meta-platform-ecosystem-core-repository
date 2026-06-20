import * as React             from "react"
import {useEffect, useState}  from "react"

import useWebSocket from "../../Hooks/useWebSocket"

import {
	Card,
	Divider,
	Icon,
	Label,
	Segment
 } from "semantic-ui-react"

import StatusBadge from "../../Components/StatusBadge"
import CopyValue   from "../../Components/CopyValue"
import { TruncateMiddle } from "../../Utils/Format"

const GetSocketName = (filePath:string) => {
	if(!filePath) return ""
	const base = filePath.split("/").pop() || filePath
	return base.replace(/\.sock$/, "")
}

// Campos do "app rodando" que valem destaque, quando presentes nos
// startup arguments / process information da instância.
const HIGHLIGHT_KEYS = ["executableName", "serverName", "namespace", "package", "port", "pid", "uptime"]

const PrimitiveEntries = (obj:any) =>
	Object.keys(obj || {})
		.filter((k) => obj[k] !== undefined && obj[k] !== null && typeof obj[k] !== "object")

const AppInformation = ({ supervisorAPI, monitoringStateKey }:any) => {

	const [ startupArguments, setStartupArguments ] = useState<any>()
	const [ processInformation, setProcessInformation ] = useState<any>()
	const [ isLoading, setIsLoading ] = useState(true)

	useEffect(() => {
		let active = true
		Promise.all([
			supervisorAPI.GetStartupArguments({ monitoringStateKey }).then(({data}:any) => data).catch(() => undefined),
			supervisorAPI.GetProcessInformation({ monitoringStateKey }).then(({data}:any) => data).catch(() => undefined)
		]).then(([startup, process]:any) => {
			if(!active) return
			setStartupArguments(startup)
			setProcessInformation(process)
			setIsLoading(false)
		})
		return () => { active = false }
	}, [])

	if(isLoading)
		return <span style={{ color: "#bbb", fontSize: ".85em" }}>carregando…</span>

	const merged = { ...(startupArguments || {}), ...(processInformation || {}) }
	const allKeys = PrimitiveEntries(merged)
	const highlighted = HIGHLIGHT_KEYS.filter((k) => allKeys.includes(k))
	const keysToShow = (highlighted.length > 0 ? highlighted : allKeys).slice(0, 3)

	if(keysToShow.length === 0)
		return <span style={{ color: "#bbb", fontSize: ".85em" }}>sem dados do app</span>

	return <span style={{ fontSize: ".85em", color: "#555" }}>
		{
			keysToShow.map((key:string, index:number) => <span key={index}>
				<span style={{ color: "#999" }}>{key}: </span>
				<strong>{String(merged[key])}</strong>
				{ index < keysToShow.length - 1 && <span style={{ color: "#ccc" }}>{"  ·  "}</span> }
			</span>)
		}
	</span>
}

const SocketCard = ({ supervisorAPI, monitoringStateKey, filePath, status, onSelect }:any) => {

	const isConnected = status === "CONNECTED"

	return <Card
		fluid
		onClick={() => onSelect(monitoringStateKey)}
		style={{ cursor: "pointer", opacity: isConnected ? 1 : 0.75, margin: 0 }}>
		<Card.Content style={{ padding: "10px 12px" }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<span style={{ fontWeight: 700 }}>
					<Icon name="plug" style={{ color: "#888" }}/> {GetSocketName(filePath)}
				</span>
				<StatusBadge status={status}/>
			</div>
			<div style={{ fontSize: ".72em", color: "#9aa0a6", display: "flex", alignItems: "center", margin: "3px 0 6px" }}>
				<span title={filePath} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{TruncateMiddle(filePath, 46)}</span>
				<CopyValue value={filePath}/>
			</div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				{
					isConnected
					? <AppInformation supervisorAPI={supervisorAPI} monitoringStateKey={monitoringStateKey}/>
					: <span style={{ color: "#c0392b", fontSize: ".85em" }}><Icon name="warning circle"/> indisponível</span>
				}
				{ isConnected && <span style={{ color: "#3a6ea5", fontSize: ".82em", whiteSpace: "nowrap" }}>inspecionar <Icon name="arrow right"/></span> }
			</div>
		</Card.Content>
	</Card>
}

const OverviewSocketPanel = ({
	supervisorAPI,
	onSelect
}:any) => {

	const [overview, setOverview] = useState<any>({})

	useEffect(() => {
		fetchOverview()
	}, [])

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

	// conectados primeiro, depois por nome do socket
	const _StatusRank = (status:string) => status === "CONNECTED" ? 0 : (status === "CONNECTING" ? 1 : 2)
	const keys = Object.keys(overview).sort((a, b) => {
		const rank = _StatusRank(overview[a]?.status) - _StatusRank(overview[b]?.status)
		if(rank !== 0) return rank
		return GetSocketName(overview[a]?.filePath).localeCompare(GetSocketName(overview[b]?.filePath))
	})
	const connectedCount = keys.filter((k) => overview[k]?.status === "CONNECTED").length
	const unavailableCount = keys.filter((k) => overview[k]?.status === "UNAVAILABLE").length

	return <Segment style={{ margin: "15px" }}>
		<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
			<h2 style={{ margin: 0, marginRight: "6px" }}><Icon name="server"/> Instances Overview</h2>
			<Label color="green" size="small"><Icon name="check circle"/> {connectedCount} connected</Label>
			{ unavailableCount > 0 && <Label color="red" size="small"><Icon name="warning circle"/> {unavailableCount} unavailable</Label> }
			<Label size="small">{keys.length} sockets</Label>
		</div>
		<Divider/>
		<div style={{
			display: "grid",
			gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
			gap: "12px"
		}}>
			{
				keys.map((monitoringStateKey:string, key:number) =>
					<SocketCard
						key={key}
						supervisorAPI={supervisorAPI}
						monitoringStateKey={monitoringStateKey}
						filePath={overview[monitoringStateKey].filePath}
						status={overview[monitoringStateKey].status}
						onSelect={onSelect}/>)
			}
		</div>
	</Segment>
}

export default OverviewSocketPanel
