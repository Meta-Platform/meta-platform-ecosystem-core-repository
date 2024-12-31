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

import SocketFileList from "../../Lists/SocketFile.list"
import GetAPI from "../../Utils/GetAPI"
import Tasks from "./Tasks"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import useFetchInstanceTaskList from "../../Hooks/useFetchInstanceTaskList"
import useFetchStartupArguments from "../../Hooks/useFetchStartupArguments"

const Column = Grid.Column

import OverviewSocketPanel from "./OverviewSocketPanel"
import StartupArguments from "./StartupArguments"

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

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	const _GetSupervisorAPI = () => 
		GetAPI({ 
			apiName:"InstancesSupervisor",
			serverManagerInformation: HTTPServerManager
		})

	useEffect(() => {

		if(Object.keys(queryParams).length > 0){

			const {
				socketFileName:socketFileNameQueryParams, 
				taskId:taskIdQueryParams
			} = queryParams

			const newQueryParmas = {
				...(socketFileNameQueryParams ? { socketFileName: socketFileNameQueryParams } : {}),
				//@ts-ignore
				...(taskIdQueryParams ? { taskId: parseInt(taskIdQueryParams) } : {})
			}

			SetQueryParams(newQueryParmas)
		}
		
		updateSocketFileList()

	}, [])

	useEffect(() => {

		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})

		if(Object.keys(QueryParams).length > 0){

			if(QueryParams.socketFileName)
				setSocketFileNameSelected(QueryParams.socketFileName)

			if(QueryParams.taskId !== undefined)
				setTaskIdSelected(QueryParams.taskId)

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

	const mainPanes = [
		{
			menuItem: <MenuItem key='tasks' style={{background: "aliceblue"}}>
							tasks
							<Label>{instanceTaskListCurrent.length}</Label>
					</MenuItem>,
		   render: () => 
			<TabPane style={{background: "aliceblue"}}>
				<Tasks 
					taskId={taskIdSelected}
					instanceTaskList={instanceTaskListCurrent}
					taskInformation={taskInformationSelected}
					onSelectTask={handleSelectTask}
				/>
			</TabPane>
		},
		{
			menuItem: <MenuItem key='startup arguments' style={{background: "gainsboro"}}>
							startup arguments		
						</MenuItem>,
			render: () =>
				<TabPane style={{background: "gainsboro"}}>
					<StartupArguments 
						startupArguments={startupArgumentsCurrent}/>
				</TabPane>
		},
	]

	const handleBackTOverview = () => {
		resetTaskSelection()
		setSocketFileNameSelected(undefined)
		RemoveQueryParam("monitoringStateKey")
	}

	return monitoringStateKeySelected
		? <Segment style={{margin:"15px", background: "antiquewhite"}}>
				<Grid columns="two" divided>
					<Column width={3}>
						<SocketFileList
							list={monitoringKeyList}
							onSelect={handleSelectInstance}
							socketFileSelected={monitoringStateKeySelected}/>
					</Column>
					<Column width={13}>
						<Menu>
							<MenuItem>
								<Button icon color="red">
									<Icon name='close'/>
									kill instance
								</Button>
							</MenuItem>
							<MenuMenu position='right'>
								<MenuItem>
									<Button icon onClick={() => handleBackTOverview()}>
										<Icon name='arrow left'/>
										go back
									</Button>
								</MenuItem>
							</MenuMenu>
						</Menu>
						<Tab panes={mainPanes} />
					</Column>
				</Grid>
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