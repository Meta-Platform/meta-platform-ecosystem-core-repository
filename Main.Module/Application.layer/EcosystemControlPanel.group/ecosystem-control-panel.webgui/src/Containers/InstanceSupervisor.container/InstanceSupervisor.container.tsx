import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import {
	Badge,
	Button,
	Drawer,
	EmptyState,
	EntityHeader,
	Icon,
	IconButton,
	SearchInput,
	Toolbar
} from "@i-components"

import qs from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import { GetAPI } from "@i-components/net"
import AppModal from "../../Components/AppModal"
import { ShortId } from "../../Utils/Format"
import Tasks from "./Tasks"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import useFetchInstanceTaskList    from "../../Hooks/useFetchInstanceTaskList"
import useFetchStartupArguments    from "../../Hooks/useFetchStartupArguments"
import useFetchInstanceInformation from "../../Hooks/useFetchInstanceInformation"

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
	const isLogOpen = logKeys.includes(monitoringStateKeySelected)

	return monitoringStateKeySelected
		? <div className="ecp-socket-detail">
				{/* Entity detail (§4): EntityHeader + conteúdo. Numa coluna flex de
				    altura fixa o cabeçalho é espremido a zero — daí o .ecp-fixed. */}
				<EntityHeader
					className="ecp-fixed"
					icon="plug"
					title={_GetSocketName(monitoringStateKeySelected)}
					status={selectedStatus}
					technicalRef={{ label: "key", value: monitoringStateKeySelected, maxChars: 22 }}
					actions={<>
						<IconButton icon="arrow left" label="back to overview" size="sm" onClick={() => handleBackTOverview()}/>
						{ !isUnavailable && <Button size="sm" icon="sliders horizontal" onClick={() => setSecondaryPanel("startup")} title="startup arguments">startup args</Button> }
						{ !isUnavailable && <Button size="sm" icon="microchip" onClick={() => setSecondaryPanel("process")} title="instance process information">process info</Button> }
						{
							!isUnavailable &&
							<Button
								size="sm"
								variant={isLogOpen ? "primary" : "default"}
								icon={isLogOpen ? "eye" : "terminal"}
								onClick={() => openLogWindow({ monitoringStateKey: monitoringStateKeySelected, socketName: _GetSocketName(monitoringStateKeySelected) })}
								title={isLogOpen ? "view open log stream" : "open process log stream"}>
								{ isLogOpen ? "view log" : "log stream" }
							</Button>
						}
						{
							!isUnavailable &&
							<Button size="sm" variant="danger" icon="times" onClick={() => setIsConfirmKillOpen(true)} title="kill instance">kill</Button>
						}
					</>}/>
				{
					isUnavailable
					? <EmptyState
						className="ecp-socket-detail__empty"
						icon="plug"
						title="Instance unavailable"
						message="The supervisor socket is not responding — the instance is not running or was terminated. There are no tasks to inspect."
						actions={<Button icon="arrow left" onClick={() => handleBackTOverview()}>back to overview</Button>}/>
					: <>
						<Toolbar className="ecp-fixed ecp-socket-detail__taskbar">
							<span className="mp-panel__title">
								<Icon name="tasks"/> Tasks
							</span>
							<Badge>{instanceTaskListCurrent.length}</Badge>
							<Toolbar.Spacer/>
							<SearchInput
								className="ecp-socket-detail__filter"
								value={taskFilter}
								onValueChange={(value:string) => setTaskFilter(value)}
								placeholder="filter tasks…"/>
						</Toolbar>
						<div className="ecp-socket-detail__body">
							<Tasks taskId={taskIdSelected} instanceTaskList={instanceTaskListCurrent} taskInformation={taskInformationSelected} taskFilter={taskFilter} onSelectTask={handleSelectTask} onCloseTask={resetTaskSelection}/>
						</div>
					</>
				}

				{
					!isUnavailable && secondaryPanel &&
					<Drawer
						open={true}
						width={460}
						title={ secondaryPanel === "startup" ? "Startup arguments" : "Instance process information" }
						onClose={() => setSecondaryPanel(null)}>
						{ secondaryPanel === "startup"
							? <StartupArguments startupArguments={startupArgumentsCurrent}/>
							: <InstanceProcessInformation processInformation={instanceProcessInformationCurrent}/> }
					</Drawer>
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
					<p className="ecp-danger-note">
						<Icon name="warning sign" tone="danger"/> <strong>Destructive and irreversible</strong> action: kills the package executor process and all its tasks.
					</p>
				</AppModal>
			</div>
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
