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
	Card,
	CardGroup,
	CardContent,
	CardHeader,
	CardMeta,
	CardDescription,
	Icon,
	Menu,
	Button
 } from "semantic-ui-react"



import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"


import SocketFileList from "../Lists/SocketFile.list"
import GetRequestByServer from "../Utils/GetRequestByServer"
import GetAPI from "../Utils/GetAPI"
import TaskListContainer from "../Containers/TaskList.container"
import TaskGroupByLoaderContainer from "../Containers/TaskGroupByLoader.container"

import TaskInformation from "../Components/TaskInformation"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

import useWebSocket from "../Hooks/useWebSocket"
import useFetchInstanceTaskList from "../Hooks/useFetchInstanceTaskList"

const Column = Grid.Column

const GetColorByStatus = (status) => {
	switch(status){
		case "ACTIVE":
			return "green"
		case "FAILURE":
			return "red"
		case "STARTING":
			return "blue"
		case "AWAITING_PRECONDITIONS":
			return "teal"
		default:
			return "orange"
	}
}

const TaskInfoCard = ({data}) => {

	const {
		taskId,
		label,
		status,
		descriptionContent
	} = data 
	return <Card>
				<CardContent>
					<CardHeader>{label}</CardHeader>
					<CardMeta><Label size="mini" color={GetColorByStatus(status)} style={{"marginRight":"5px"}}>{status}</Label>Task ID {taskId}</CardMeta>
					<CardDescription>{descriptionContent}</CardDescription>
				</CardContent>
			</Card>
}

const TaskCardGroup = ({tasklist}) => {


	const _GetApplicationInstanceCardData = () => {

		const data = tasklist.find(({objectLoaderType}) => objectLoaderType === "application-instance")

		if(data){
			return {
				taskId: data.taskId,
				label: "Application Instance Task",
				status: data.status,
				descriptionContent: <>
					<i style={{"color": "grey"}}>namespace</i><br/>
					<strong>{data.staticParameters.namespace}</strong>
				</>
			}
		}
		
	}

	const _GetServerManagerCardDataCardData = () => {
		const data = tasklist
			.find(({objectLoaderType, staticParameters}) => objectLoaderType === "service-instance" && staticParameters?.path === "Services/HTTPServer.service")

		if(data){

			const getURL = () => {
				if(isNaN(data.staticParameters.port)) return data.staticParameters.port
				else return <a href={`http://localhost:${data.staticParameters.port}`}>http://localhost:{data.staticParameters.port}</a>
			}
			
			return {
				taskId: data.taskId,
				label: "Server Manager Service Task",
				status: data.status,
				descriptionContent: <>
					<i style={{"color": "grey"}}>server name</i><br/>
					<strong>{data.staticParameters.name}</strong><br/>
					<strong>{getURL()}</strong>
				</>
			}
		}
	}

	const applicationInstanceCardData = _GetApplicationInstanceCardData()
	const serverManagerCardData = _GetServerManagerCardDataCardData()

	return <CardGroup>
		{applicationInstanceCardData && <TaskInfoCard data={applicationInstanceCardData}/>}
		{serverManagerCardData && <TaskInfoCard data={serverManagerCardData}/>}
</CardGroup>
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

	const getSupervisorAPI = () => 
		GetAPI({ apiName:"InstancesMonitor", serverManagerInformation: HTTPServerManager })

	useWebSocket({
		socket          : getSupervisorAPI().InstanceSocketFileListChange,
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


	const _GetWebservice = GetRequestByServer(HTTPServerManager)

	const fetchTaskInformation = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesMonitor")
		.GetTaskInformation({ socketFilename:socketFileNameSelected, taskId:taskIdSelected })
		.then(({data}:any) => setTaskInformationSelected(data))


	const updateSocketFileList = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesMonitor")
			.ListSockets()
			.then(({data}:any) => {
				setSocketFileList(data) 
			})

	const handleSelectInstance = (socketFileName) => {
		setTaskIdSelected(undefined)
		setTaskInformationSelected(undefined)
		RemoveQueryParam("taskId")
		setSocketFileNameSelected(socketFileName)
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

	return <Segment style={{margin:"15px", background: "antiquewhite"}}>
				<Grid columns="two" divided>
						<Column width={2}>
							<SocketFileList
								list={socketFileList}
								onSelect={handleSelectInstance}
								socketFileSelected={socketFileNameSelected}
								/>
						</Column>
						<Column width={14}>
							<Menu>
								<MenuMenu position='right'>
									<MenuItem>
										<Button icon color="red">
											<Icon name='close'/>
											kill instance
										</Button>
									</MenuItem>
								</MenuMenu>
							</Menu>
							<Tab panes={mainPanes} />
						</Column>
					</Grid>
			</Segment>
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