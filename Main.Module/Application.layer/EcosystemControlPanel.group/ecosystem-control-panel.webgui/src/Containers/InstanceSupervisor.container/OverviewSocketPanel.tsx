import * as React             from "react"
import {useEffect, useState}  from "react"

import useWebSocket from "../../Hooks/useWebSocket"

import {
	Button,
	CopyableMonoText,
	EmptyState,
	Icon,
	PageMasthead,
	StatusBadge,
	StatusChip,
	StatusStrip,
	TruncateMiddle
} from "@i-components"

import { openLogWindow, subscribeLogWindows } from "../../Utils/logWindows"

const NormalizePath = (value:string) => (value || "").replace(/\\/g, "/").replace(/\/+$/, "")

const GetSocketName = (filePath:string) => {
	if(!filePath) return ""
	const base = filePath.split("/").pop() || filePath
	return base.replace(/\.sock$/, "")
}

const GetParentDir = (filePath:string) => {
	const normalized = NormalizePath(filePath)
	const index = normalized.lastIndexOf("/")
	return index > 0 ? normalized.slice(0, index) : ""
}

const GetCommonDirPrefix = (paths:string[]) => {
	const normalized = paths.map((p) => NormalizePath(p)).filter(Boolean)
	if(normalized.length === 0) return ""
	const splitPaths = normalized.map((p) => p.split("/"))
	const prefix:string[] = []
	const first = splitPaths[0]
	for(let i = 0; i < first.length; i++) {
		const segment = first[i]
		if(splitPaths.every((parts) => parts[i] === segment))
			prefix.push(segment)
		else
			break
	}
	return prefix.length > 0 ? prefix.join("/") : ""
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
		return <span className="ecp-socket-cell__hint">no app data</span>
	return <span className="ecp-socket-cell__app">
		{ exeName && <span className="mp-type-chip"><Icon name="terminal"/> {exeName}</span> }
		{
			otherKeys.map((key:string, index:number) => <span key={index}>
				<span className="ecp-socket-cell__key">{key}: </span>
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

	return <tr
		className={`is-clickable ecp-socket-row ${isConnected ? "" : "is-dim"}`.trim()}
		onClick={() => onSelect(monitoringStateKey)}>
		<td>
			<span className="ecp-socket-cell__name">
				<Icon name="plug" tone={isConnected ? "success" : "danger"}/>
				<strong>{socketName}</strong>
				{ logOpen && <Icon name="terminal" tone="info" className="ecp-live-pulse" title="log stream ao vivo"/> }
			</span>
		</td>
		<td><StatusBadge status={status}/></td>
		<td className="is-mono">
			{ !isConnected ? "—" : (isLoading ? "…" : (pid != null ? String(pid) : "—")) }
		</td>
		<td title={filePath}>
			<CopyableMonoText value={filePath} maxChars={36}/>
		</td>
		<td>
			{
				!isConnected
				? <span className="ecp-socket-cell__unavailable"><Icon name="warning circle"/> unavailable</span>
				: isLoading
					? <span className="ecp-socket-cell__hint">loading…</span>
					: (appNamespace || serverUrl)
						? <div className="ecp-socket-cell__app-lines">
							{ appNamespace && <span className="ecp-truncate" title={appNamespace}><Icon name="cube" tone="muted"/> <strong>{appNamespace}</strong></span> }
							{ serverUrl && <span className="ecp-truncate" title={serverUrl}><Icon name="server" tone="muted"/> {TruncateMiddle(serverUrl, 38)}</span> }
						</div>
						: <AppInfo merged={merged}/>
			}
		</td>
		<td className="ecp-socket-cell__actions" onClick={(event:any) => event.stopPropagation()}>
			{
				isConnected &&
				<Button
					variant="ghost"
					size="sm"
					icon={logOpen ? "eye" : "terminal"}
					title={logOpen ? "view open log stream" : "open log stream"}
					onClick={() => openLogWindow({ monitoringStateKey, socketName })}>
					{ logOpen ? "view log" : "log" }
				</Button>
			}
			<Button
				variant="ghost"
				size="sm"
				trailingIcon="arrow right"
				onClick={() => onSelect(monitoringStateKey)}>
				inspect
			</Button>
		</td>
	</tr>
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
	// Prefixo comum calculado sobre os diretórios-pais (não sobre os arquivos),
	// senão o nome do .sock entra no prefixo e o caminho absoluto vaza no rótulo.
	const parentDirs = keys.map((k) => GetParentDir(overview[k]?.filePath)).filter(Boolean)
	const commonDir = GetCommonDirPrefix(parentDirs)
	const socketsRootLabel = commonDir.split("/").filter(Boolean).pop() || "supervisor"
	const groupedKeys = keys.reduce((groups:any, monitoringStateKey:string) => {
		const parentDir = GetParentDir(overview[monitoringStateKey]?.filePath)
		const relativeDir = commonDir && parentDir.startsWith(commonDir)
			? parentDir.slice(commonDir.length).replace(/^\/+/, "")
			: parentDir
		const groupKey = relativeDir || "__root__"
		const groupLabel = relativeDir || socketsRootLabel
		if(!groups[groupKey])
			groups[groupKey] = { groupKey, groupLabel, items: [] }
		groups[groupKey].items.push(monitoringStateKey)
		return groups
	}, {})
	const groupedKeyList = Object.values(groupedKeys).sort((a:any, b:any) => a.groupLabel.localeCompare(b.groupLabel))
	const connectedCount = keys.filter((k) => overview[k]?.status === "CONNECTED").length
	const unavailableCount = keys.filter((k) => overview[k]?.status === "UNAVAILABLE").length

	// Padrão Collection (§4): PageMasthead + StatusStrip + ledger table. A tabela
	// é escrita à mão (e não com DataTable) porque tem linha de GRUPO em colSpan e
	// cada linha carrega estado próprio (pid/tasks buscados por socket).
	return <div className="ecp-socket-overview">
		<PageMasthead
			icon="server"
			title="Supervisor Sockets"
			subtitle="Monitor local supervisor sockets, connection status, PID and associated apps.">
			<StatusStrip>
				<StatusChip icon="check circle" tone="success" count={connectedCount} label="connected"/>
				{ unavailableCount > 0 && <StatusChip icon="warning circle" tone="danger" count={unavailableCount} label="unavailable"/> }
				<StatusChip icon="plug" count={keys.length} label="sockets"/>
			</StatusStrip>
		</PageMasthead>
		{
			keys.length === 0
			? <EmptyState
				icon="plug"
				title="No supervisor sockets"
				message="No package executor is exposing a supervisor socket right now."/>
			: <div className="mp-table-wrap">
				<table className="mp-table ecp-socket-table">
					<thead>
						<tr>
							<th style={{ width: "18.75%" }}>socket</th>
							<th style={{ width: "12.5%" }}>status</th>
							<th style={{ width: "10%" }}>pid</th>
							<th style={{ width: "25%" }}>path</th>
							<th style={{ width: "18.75%" }}>app</th>
							<th style={{ width: "15%" }}/>
						</tr>
					</thead>
					<tbody>
						{
							groupedKeyList.map((group:any) =>
								<React.Fragment key={group.groupKey}>
									<tr className="ecp-socket-table__group">
										<td colSpan={6}>{group.groupLabel}</td>
									</tr>
									{
										group.items.map((monitoringStateKey:string, key:number) =>
											<SocketRow
												key={`${group.groupKey}-${key}`}
												supervisorAPI={supervisorAPI}
												monitoringStateKey={monitoringStateKey}
												filePath={overview[monitoringStateKey].filePath}
												status={overview[monitoringStateKey].status}
												logOpen={logKeys.includes(monitoringStateKey)}
												onSelect={onSelect}/>)
									}
								</React.Fragment>)
						}
					</tbody>
				</table>
			</div>
		}
	</div>
}

export default OverviewSocketPanel
