import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Grid }               from "semantic-ui-react"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import PageDefault from "../Components/PageDefault"
import SocketFileList from "../Lists/SocketFile.list"
import GetRequestByServer from "../Utils/GetRequestByServer"
import TaskItem from "../Components/TaskItem"

import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const Column = Grid.Column

const MainPage = ({
	HTTPServerManager,
	QueryParams,
	AddQueryParam,
	SetQueryParams,
	RemoveQueryParam
}:any) => {

	const [socketFileList, setSocketFileList] = useState([])
	const [instanceTaskListSelected, setInstanceTaskListSelected] = useState([])

	const [socketFileNameSelected, setSocketFileNameSelected] = useState<string>()
	const [taskIdSelected, setTaskIdSelected] = useState<number>()

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

			if(QueryParams.taskIdSelected !== undefined)
				setTaskIdSelected(QueryParams.taskIdSelected)

		}

	}, [QueryParams])

	useEffect(() => {

		if(socketFileNameSelected){
			AddQueryParam("socketFileName", socketFileNameSelected)
			setTaskIdSelected(undefined)
			RemoveQueryParam("taskId")
			fetchInstanceTasks(socketFileNameSelected)
		}
		
	}, [socketFileNameSelected])

	useEffect(() => {

		if(taskIdSelected !== undefined)
			AddQueryParam("taskId", taskIdSelected)

	}, [taskIdSelected])

	const _GetWebservice = GetRequestByServer(HTTPServerManager)

	const fetchInstanceTasks = (socketFileName) => 
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
		.ListInstanceTasks({ socketFilename:socketFileName})
		.then(({data}:any) => setInstanceTaskListSelected(data))

	const updateSocketFileList = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
			.ListSockets()
			.then(({data}:any) => {
				setSocketFileList(data) 
			})

	const handleSelectInstance = (socketFileName) => 
		setSocketFileNameSelected(socketFileName)

	const handleSelectTask = (taskId) => 
		setTaskIdSelected(taskId)

	return <PageDefault>
	<ColumnGroup columns="three">
		<Column width={4}>
			<SocketFileList
				list={socketFileList}
				onSelect={handleSelectInstance}
				socketFileSelected={socketFileNameSelected}
				/>
		</Column>
		<Column width={12}>
			{ 
				instanceTaskListSelected 
				&& <div style={{ overflow: 'auto', maxHeight:"87vh" }}>
					{
						instanceTaskListSelected
						.map((task, index) =>
							<TaskItem 
								key={index} 
								index={index} 
								task={task}
								onShowTaskDetails={handleSelectTask}/>)
					}
				</div>
			}
		</Column>
		<Column width={8}>
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