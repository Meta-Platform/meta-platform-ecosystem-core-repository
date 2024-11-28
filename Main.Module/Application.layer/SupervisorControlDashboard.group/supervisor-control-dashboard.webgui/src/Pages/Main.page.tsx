import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { 
	Grid,
	Input,
ButtonGroup
 } from "semantic-ui-react"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import PageDefault from "../Components/PageDefault"
import SocketFileList from "../Lists/SocketFile.list"
import GetRequestByServer from "../Utils/GetRequestByServer"
import TaskItem from "../Components/TaskItem"
import TaskListContainer from "../Containers/TaskList.container"

import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"
import TaskInformation from "../Components/TaskInformation"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const Column = Grid.Column
const Row = Grid.Column

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

	const _GetWebservice = GetRequestByServer(HTTPServerManager)

	const fetchTaskInformation = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
		.ShowInstanceTaskInformation({ socketFilename:socketFileNameSelected, taskId:taskIdSelected })
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

	const handleSelectTask = (taskId) => 
		setTaskIdSelected(taskId)

	return <PageDefault>
	<ColumnGroup columns="three">
		<Column width={2}>
			<SocketFileList
				list={socketFileList}
				onSelect={handleSelectInstance}
				socketFileSelected={socketFileNameSelected}
				/>
		</Column>
		<Column width={taskIdSelected === undefined ? 14 : 8}>
			<Row>					
					<ButtonGroup
						basic
                        floated="right"
                        buttons={[{content:'list by TID', active:true}, 'group by loader type', 'diagram']}/>
			</Row>
			<TaskListContainer
				socketFileNameSelected={socketFileNameSelected}
				taskIdSelected={taskIdSelected}
				onSelectTask={handleSelectTask}/>

		</Column>
		
		{
			taskIdSelected !== undefined
			&& <Column width={6}>
				{
					taskInformationSelected
					&& <TaskInformation taskInformation={taskInformationSelected}/>
				}
			</Column>
		}
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