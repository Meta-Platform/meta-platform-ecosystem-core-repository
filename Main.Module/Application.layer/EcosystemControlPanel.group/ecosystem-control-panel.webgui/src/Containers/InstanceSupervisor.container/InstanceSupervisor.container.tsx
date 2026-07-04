import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { 
	Grid,
	MenuItem,
	Label,
	TabPane, 
	Tab,
	Segment,
	MenuMenu,
	Icon,
	Input,
	Menu,
	Button
 } from "semantic-ui-react"

import qs from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import GetAPI from "../../Utils/GetAPI"
import AppModal from "../../Components/AppModal"
import EmptyState from "../../Components/EmptyState"
import EntityHeader from "../../Components/ui/EntityHeader"
import { ShortId } from "../../Utils/Format"
import Tasks from "./Tasks"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import useFetchInstanceTaskList    from "../../Hooks/useFetchInstanceTaskList"
import useFetchStartupArguments    from "../../Hooks/useFetchStartupArguments"
import useFetchInstanceInformation from "../../Hooks/useFetchInstanceInformation"

const Column = Grid.Column

import OverviewSocketPanel from "./OverviewSocketPanel"
import StartupArguments from "./StartupArguments"
import InstanceProcessInformation from "./InstanceProcessInformation"
import { openLogWindow, subscribeLogWindows } from "../../Utils/logWindows"

const InstanceSupervisorContainer = ({
	HTTPServerManager,
	QueryParams,
	AddQueryParam,
	SetQueryParams,
	RemoveQueryParam
}:any) => {

	const [monitoringKeyList, setMonitoringKeyList] = useState([])

	const [monitoringStateKeySelected, setSocketFileNameSelected] = useState<string>()
	const [taskIdSelected, setTaskIdSelected] = useState<number>()
	const [taskInformationSelected, setTaskInformationSelected] = useState<any>()
	const [isConfirmKillOpen, setIsConfirmKillOpen] = useState(false)
	const [overview, setOverview] = useState<any>()
	const [logKeys, setLogKeys] = useState<string[]>([])
	const [taskFilter, setTaskFilter] = useState("")

	useEffect(() => subscribeLogWindows((ws:any[]) => setLogKeys(ws.map((w) => w.monitoringStateKey))), [])
	// painel secundário (drawer): startup arguments | instance process information
	const [secondaryPanel, setSecondaryPanel] = useState<null | "startup" | "process">(null)

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	const _GetSupervisorAPI = () => 
		GetAPI({ 
			apiName:"InstancesSupervisor",
			serverManagerInformation: HTTPServerManager
		})

	useEffect(() => {
		updateSocketFileList()
	}, [])

	useEffect(() => {

		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})

		// sincroniza nos DOIS sentidos: quando o param sai da URL (ex.: clicar
		// em "overview" no sidebar), a seleção interna precisa ser limpa —
		// senão o painel ficava preso no detalhe e o overview "parava".
		setSocketFileNameSelected(QueryParams.monitoringStateKey || undefined)

		if(QueryParams.taskId !== undefined)
			setTaskIdSelected(QueryParams.taskId)
		else {
			setTaskIdSelected(undefined)
			setTaskInformationSelected(undefined)
		}

	}, [QueryParams])

	useEffect(() => {

		if(monitoringStateKeySelected)
			AddQueryParam("monitoringStateKey", monitoringStateKeySelected)
		
	}, [monitoringStateKeySelected])

	useEffect(() => {

		if(taskIdSelected !== undefined){
			AddQueryParam("taskId", taskIdSelected)
			fetchTaskInformation()
		}

	}, [taskIdSelected])

	const instanceTaskListCurrent = 
        useFetchInstanceTaskList({
            monitoringStateKeySelected,
            HTTPServerManager
        })

	const startupArgumentsCurrent = 
		useFetchStartupArguments({
			monitoringStateKeySelected,
			HTTPServerManager
		})

	const instanceProcessInformationCurrent = 
		useFetchInstanceInformation({
			monitoringStateKeySelected,
			HTTPServerManager
		})
	const fetchTaskInformation = () => 
		_GetSupervisorAPI()
		.GetTaskInformation({ monitoringStateKey:monitoringStateKeySelected, taskId:taskIdSelected })
		.then(({data}:any) => setTaskInformationSelected(data))


	const updateSocketFileList = () =>
		_GetSupervisorAPI()
			.ListMonitoringKeys()
			.then(({data}:any) => {
				setMonitoringKeyList(data)
			})

	// status do socket selecionado (para detectar instância indisponível)
	useEffect(() => {
		_GetSupervisorAPI().Overview().then(({data}:any) => setOverview(data)).catch(() => setOverview({}))
	}, [monitoringStateKeySelected])
	
	const resetTaskSelection = () => {
		setTaskIdSelected(undefined)
		setTaskInformationSelected(undefined)
		RemoveQueryParam("taskId")
	}
	
	const handleSelectInstance = (socketFileName) => {
		resetTaskSelection()
		setSocketFileNameSelected(socketFileName)
		RemoveQueryParam("taskId")
	}

	const handleSelectTask = (taskId) => 
		setTaskIdSelected(taskId)

	const KillInstance = () => {
		_GetSupervisorAPI()
		.KillInstance({ monitoringStateKey:monitoringStateKeySelected })
	}

	const handleKillInstance = () => KillInstance()

	const _GetSocketName = (key:string) => {
		const fp = overview && overview[key] && overview[key].filePath
		return fp ? (fp.split("/").pop() || "").replace(/\.sock$/, "") : ShortId(key, 8, 6)
	}

	const handleBackTOverview = () => {
		resetTaskSelection()
		setSocketFileNameSelected(undefined)
		RemoveQueryParam("monitoringStateKey")
	}

	const selectedStatus = overview ? overview[monitoringStateKeySelected]?.status : undefined
	const isUnavailable = overview !== undefined && selectedStatus !== "CONNECTED"

	return monitoringStateKeySelected
		? <Segment style={{ margin: "15px", height: "calc(100vh - 110px)", display: "flex", flexDirection: "column" }}>
				<EntityHeader
					icon="plug"
					title={_GetSocketName(monitoringStateKeySelected)}
					status={selectedStatus}
					technicalRef={{ label: "key", value: monitoringStateKeySelected, maxChars: 22 }}
					actions={<>
						<Button basic icon size="small" onClick={() => handleBackTOverview()} title="back to overview"><Icon name="arrow left"/></Button>
						{ !isUnavailable && <Button basic size="small" onClick={() => setSecondaryPanel("startup")} title="startup arguments"><Icon name="sliders horizontal"/> startup args</Button> }
						{ !isUnavailable && <Button basic size="small" onClick={() => setSecondaryPanel("process")} title="instance process information"><Icon name="microchip"/> process info</Button> }
						{
							!isUnavailable &&
							<Button
								basic size="small"
								color={logKeys.includes(monitoringStateKeySelected) ? "green" : "blue"}
								onClick={() => openLogWindow({ monitoringStateKey: monitoringStateKeySelected, socketName: _GetSocketName(monitoringStateKeySelected) })}
								title={logKeys.includes(monitoringStateKeySelected) ? "view open log stream" : "open process log stream"}>
								<Icon name={logKeys.includes(monitoringStateKeySelected) ? "eye" : "terminal"}/>
								{ logKeys.includes(monitoringStateKeySelected) ? "view log" : "log stream" }
							</Button>
						}
						{
							!isUnavailable &&
							<Button color="red" basic size="small" onClick={() => setIsConfirmKillOpen(true)} title="kill instance"><Icon name="close"/> kill</Button>
						}
					</>}/>
				{
					isUnavailable
					? <EmptyState
						icon={<Icon.Group size="huge" style={{ color: "var(--mp-line-soft)" }}>
							<Icon name="plug"/>
							<Icon corner name="dont" color="red"/>
						</Icon.Group>}
						title="Instance unavailable"
						description="The supervisor socket is not responding — the instance is not running or was terminated. There are no tasks to inspect."
						action={<Button basic icon labelPosition="left" onClick={() => handleBackTOverview()}><Icon name="arrow left"/> back to overview</Button>}/>
					: <>
						<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap", flex: "0 0 auto" }}>
							<span style={{ fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--mp-ink)" }}>
								<Icon name="tasks" style={{ margin: 0 }}/> Tasks <Label circular size="mini">{instanceTaskListCurrent.length}</Label>
							</span>
							<Input icon="search" size="small" placeholder="filter tasks..." value={taskFilter}
								onChange={(e:any, { value }:any) => setTaskFilter(value)} style={{ marginLeft: "auto" }}/>
						</div>
						<div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
							<Tasks taskId={taskIdSelected} instanceTaskList={instanceTaskListCurrent} taskInformation={taskInformationSelected} taskFilter={taskFilter} onSelectTask={handleSelectTask} onCloseTask={resetTaskSelection}/>
						</div>
					</>
				}

				{
					!isUnavailable && secondaryPanel && <>
						<div className="mp-offcanvas__scrim" onClick={() => setSecondaryPanel(null)} style={{ zIndex: 1400 }}/>
						<div className="mp-offcanvas" style={{ width: "460px", maxWidth: "92vw", zIndex: 1450 }}>
							<div style={{ height: "56px", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "2px solid var(--mp-line-strong)", background: "var(--mp-paper-2)" }}>
								<strong style={{ fontFamily: "var(--mp-font-display)" }}>{ secondaryPanel === "startup" ? "Startup arguments" : "Instance process information" }</strong>
								<Button circular basic icon size="mini" onClick={() => setSecondaryPanel(null)}><Icon name="close"/></Button>
							</div>
							<div style={{ padding: "12px", overflow: "auto", flex: "1 1 auto" }}>
								{ secondaryPanel === "startup"
									? <StartupArguments startupArguments={startupArgumentsCurrent}/>
									: <InstanceProcessInformation processInformation={instanceProcessInformationCurrent}/> }
							</div>
						</div>
					</>
				}

				<AppModal
					variant="danger"
					open={isConfirmKillOpen}
					header="Terminate instance"
					confirmText="terminate instance"
					confirmIcon="close"
					onCancel={() => setIsConfirmKillOpen(false)}
					onConfirm={() => { setIsConfirmKillOpen(false); KillInstance() }}>
					<p>Terminate instance <code>{ShortId(monitoringStateKeySelected, 10, 8)}</code>?</p>
					<p style={{ color: "var(--mp-danger)" }}>
						<Icon name="warning sign"/> <strong>Destructive and irreversible</strong> action: kills the package executor process and all its tasks.
					</p>
				</AppModal>
			</Segment>
		: <OverviewSocketPanel
			onSelect={handleSelectInstance}
			supervisorAPI={_GetSupervisorAPI()}/>

}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam    : QueryParamsActionsCreator.AddQueryParam,
	SetQueryParams   : QueryParamsActionsCreator.SetQueryParams,
	RemoveQueryParam : QueryParamsActionsCreator.RemoveQueryParam
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(InstanceSupervisorContainer)