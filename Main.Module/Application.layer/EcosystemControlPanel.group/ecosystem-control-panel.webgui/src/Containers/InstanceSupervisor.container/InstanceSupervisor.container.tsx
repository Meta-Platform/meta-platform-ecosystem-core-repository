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
	Button,
	Divider,
	CardGroup,
	Card,
	CardContent,
	CardHeader,
	CardMeta
 } from "semantic-ui-react"

import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"


import SocketFileList from "../../Lists/SocketFile.list"
import GetAPI from "../../Utils/GetAPI"
import TaskListContainer from "../../Containers/TaskList.container"
import TaskGroupByLoaderContainer from "../../Containers/TaskGroupByLoader.container"

import TaskInformation from "../../Components/TaskInformation"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import useWebSocket from "../../Hooks/useWebSocket"
import useFetchInstanceTaskList from "../../Hooks/useFetchInstanceTaskList"

const Column = Grid.Column

import TaskCardGroup from "./Task.cardGroup"

const OverviewSocketPanel = ({
	socketFileSelected,
	supervisorAPI,
	onSelect
}) => {

	const [overview, setOverview] = useState({})

	useEffect(() => {
		fetchOverview()
	}, [])

	const fetchOverview = () => 
		supervisorAPI
		.Overview()
		.then(({data}:any) => setOverview(data))

	return <Segment style={{margin:"15px", background: "antiquewhite"}}>
	<h1>Overview</h1>
	<Divider/>
	<CardGroup>
		{
			Object.keys(overview)
			.map((socketFileName) => 
			<Card onClick={() => onSelect(socketFileName)}>
				<CardContent>
					<CardHeader>{socketFileName}</CardHeader>
					<CardMeta>xpto</CardMeta>
				</CardContent>
			</Card>)
		}
	</CardGroup>
</Segment>
}

const InstanceSupervisorContainer = ({
	HTTPServerManager,
	QueryParams,
	AddQueryParam,
	SetQueryParams,
	RemoveQueryParam
}:any) => {

	const [socketFileList, setSocketFileList] = useState([])

	const [socketFileNameSelected, setSocketFileNameSelected] = useState<string>()
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

	useWebSocket({
		socket          : _GetSupervisorAPI().InstanceSocketFileListChange,
		onMessage       : (socketFileList) => setSocketFileList(socketFileList),
		onConnection    : () => {},
		onDisconnection : () => {}
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

		if(socketFileNameSelected)
			AddQueryParam("socketFileName", socketFileNameSelected)
		
	}, [socketFileNameSelected])

	useEffect(() => {

		if(taskIdSelected !== undefined){
			AddQueryParam("taskId", taskIdSelected)
			fetchTaskInformation()
		}

	}, [taskIdSelected])

	const instanceTaskListSelected = 
        useFetchInstanceTaskList({
            socketFileNameSelected,
            HTTPServerManager
        })



	const fetchTaskInformation = () => 
		_GetSupervisorAPI()
		.GetTaskInformation({ socketFileName:socketFileNameSelected, taskId:taskIdSelected })
		.then(({data}:any) => setTaskInformationSelected(data))


	const updateSocketFileList = () => 
		_GetSupervisorAPI()
			.ListSockets()
			.then(({data}:any) => {
				setSocketFileList(data) 
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

	const taskViewPanes = [
		{
			menuItem: 'group by loader', render: () => 
			<TabPane>
				<TaskGroupByLoaderContainer
					instanceTaskListSelected={instanceTaskListSelected}
					taskIdSelected={taskIdSelected}
					onSelectTask={handleSelectTask}/>
			</TabPane>
		},
		{
			menuItem: 'list by id', render: () => 
			<TabPane style={{background: "#f6f7f8"}}>
				<TaskListContainer
					instanceTaskListSelected={instanceTaskListSelected}
					taskIdSelected={taskIdSelected}
					onSelectTask={handleSelectTask}/>
			</TabPane>
		},
		{
			menuItem: 'group by hierarchy', render: () => 
			<TabPane style={{background: "#f6f7f8"}}>
				group by hierarchy
			</TabPane>
		},
		{
			menuItem: 'diagram', render: () => 
			<TabPane>
				diagram
			</TabPane>
		}

	]

	const mainPanes = [
		{
			menuItem: <MenuItem key='Tasks' style={{background: "aliceblue"}}>
							Tasks
							<Label>{instanceTaskListSelected.length}</Label>
					</MenuItem>,
		   render: () => 
			<TabPane style={{background: "aliceblue"}}>
				<Grid columns="three" style={{background: "aliceblue"}} divided>
					<Column width={taskIdSelected === undefined ? 16 : 11}>
						<TaskCardGroup tasklist={instanceTaskListSelected}/>
						<Tab menu={{ color: "aliceblue" , secondary: true, pointing: true }} panes={taskViewPanes} />
					</Column>
					{
						taskIdSelected !== undefined
						&& <Column width={5}>
							{
								taskInformationSelected
								&& <TaskInformation taskInformation={taskInformationSelected}/>
							}
						</Column>
					}
				</Grid>
			</TabPane>
		},
		{ menuItem: 'Startup Params', render: () => <TabPane>Tab 2 Content</TabPane> },
	]

	const handleSelectTask = (taskId) => 
		setTaskIdSelected(taskId)

	const handleBackTOverview = () => {
		resetTaskSelection()
		setSocketFileNameSelected(undefined)
		RemoveQueryParam("socketFileName")
	}

	return socketFileNameSelected
		? <Segment style={{margin:"15px", background: "antiquewhite"}}>
				<Grid columns="two" divided>
					<Column width={3}>
						<SocketFileList
							list={socketFileList}
							onSelect={handleSelectInstance}
							socketFileSelected={socketFileNameSelected}/>
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
			socketFileSelected={socketFileNameSelected}
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