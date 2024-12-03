import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { 
	Grid,
	MenuItem,
	Label,
	TabPane, Tab 
 } from "semantic-ui-react"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import PageDefault from "../Components/PageDefault"
import SocketFileList from "../Lists/SocketFile.list"
import GetRequestByServer from "../Utils/GetRequestByServer"
import GetAPI from "../Utils/GetAPI"
import TaskListContainer from "../Containers/TaskList.container"
import TaskGroupByLoaderContainer from "../Containers/TaskGroupByLoader.container"

import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"
import TaskInformation from "../Components/TaskInformation"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

import useWebSocket from "../Hooks/useWebSocket"
import useFetchInstanceTaskList from "../Hooks/useFetchInstanceTaskList"

const Column = Grid.Column


const MainPage = ({
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
		GetAPI({ apiName:"Supervisor", serverManagerInformation: HTTPServerManager })

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
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
		.GetTaskInformation({ socketFilename:socketFileNameSelected, taskId:taskIdSelected })
		.then(({data}:any) => setTaskInformationSelected(data))


	const updateSocketFileList = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
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
		{ menuItem: 'Instance Events', render: () => <TabPane>Tab 2 Content</TabPane> },
	]

	const handleSelectTask = (taskId) => 
		setTaskIdSelected(taskId)

	return <PageDefault>
				<ColumnGroup columns="three">
					<Column width={3}>
						<SocketFileList
							list={socketFileList}
							onSelect={handleSelectInstance}
							socketFileSelected={socketFileNameSelected}
							/>
					</Column>
					<Column width={13}>
						<Tab panes={mainPanes} />
					</Column>
					
				</ColumnGroup>
			</PageDefault>
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

export default connect(mapStateToProps, mapDispatchToProps)(MainPage)