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
	Menu,
	Button
 } from "semantic-ui-react"

import qs from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import GetAPI from "../../Utils/GetAPI"
import CopyValue from "../../Components/CopyValue"
import AppModal from "../../Components/AppModal"
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

	const mainPanes = [
		{
			menuItem: <MenuItem key='tasks'>
							tasks
							<Label>{instanceTaskListCurrent.length}</Label>
					</MenuItem>,
		   render: () =>
			<TabPane>
				<Tasks
					taskId={taskIdSelected}
					instanceTaskList={instanceTaskListCurrent}
					taskInformation={taskInformationSelected}
					onSelectTask={handleSelectTask}
				/>
			</TabPane>
		},
		{
			menuItem: <MenuItem key='startup arguments'>
							startup arguments
						</MenuItem>,
			render: () =>
				<TabPane>
					<StartupArguments
						startupArguments={startupArgumentsCurrent}/>
				</TabPane>
		},
		{
			menuItem: <MenuItem key='instance process information'>
							instance process information
						</MenuItem>,
			render: () =>
				<TabPane>
					<InstanceProcessInformation
						processInformation={instanceProcessInformationCurrent}/>
				</TabPane>
		}
	]

	const handleBackTOverview = () => {
		resetTaskSelection()
		setSocketFileNameSelected(undefined)
		RemoveQueryParam("monitoringStateKey")
	}

	return monitoringStateKeySelected
		? <Segment style={{margin:"15px"}}>
				<Menu>
					<MenuItem>
						<Button icon onClick={() => handleBackTOverview()}>
							<Icon name='arrow left'/>
							overview
						</Button>
					</MenuItem>
					<MenuItem>
						<Icon name="microchip"/>
						<span style={{ fontFamily: "monospace", marginLeft: "6px" }} title={monitoringStateKeySelected}>{ShortId(monitoringStateKeySelected, 8, 6)}</span>
						<CopyValue value={monitoringStateKeySelected}/>
					</MenuItem>
					<MenuMenu position='right'>
						<MenuItem>
							<Button icon color="red" basic onClick={() => setIsConfirmKillOpen(true)}>
								<Icon name='close'/>
								kill instance
							</Button>
						</MenuItem>
					</MenuMenu>
				</Menu>
				<Tab panes={mainPanes} />

				<AppModal
					variant="danger"
					open={isConfirmKillOpen}
					header="Encerrar instância"
					confirmText="encerrar instância"
					confirmIcon="close"
					onCancel={() => setIsConfirmKillOpen(false)}
					onConfirm={() => { setIsConfirmKillOpen(false); KillInstance() }}>
					<p>Encerrar a instância <code>{ShortId(monitoringStateKeySelected, 10, 8)}</code>?</p>
					<p style={{ color: "#9f3a38" }}>
						<Icon name="warning sign"/> Ação <strong>destrutiva e irreversível</strong>: mata o processo do package executor e todas as suas tasks.
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