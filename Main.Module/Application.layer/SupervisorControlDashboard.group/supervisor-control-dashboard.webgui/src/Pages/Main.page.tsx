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
	SetQueryParams,
	QueryParams,
	SetPackageDetails
}:any) => {

	const [socketFileList, setSocketFileList] = useState([])
	const [instanceTaskList, setInstanceTaskList] = useState([])
	const [socketFileName, setSocketFileName] = useState()

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
		}
		updateSocketFileList()
	}, [])

	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])

	useEffect(() => {
		if(socketFileName){
			fetchInstanceTasks(socketFileName)
		}
	}, [socketFileName])

	const _GetWebservice = GetRequestByServer(HTTPServerManager)

	const fetchInstanceTasks = (socketFileName) => {
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
		.ListInstanceTasks({
			socketFilename:socketFileName
		})
		.then(({data}:any) => {
			setInstanceTaskList(data) 
		})
	}

	const updateSocketFileList = () => {
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
		.ListSockets()
		.then(({data}:any) => {
			setSocketFileList(data) 
		})
	}

	const handleSelectInstance = (socketFileName) => 
		setSocketFileName(socketFileName)


	console.log(instanceTaskList)

	return <PageDefault>
	<ColumnGroup columns="three">
		<Column width={4}>
			<SocketFileList
				list={socketFileList}
				onSelect={handleSelectInstance}
				socketFileSelected={socketFileName}
				/>
		</Column>
		<Column width={12}>
			{ 
				instanceTaskList 
				&& <div style={{ overflow: 'auto', maxHeight:"87vh" }}>
					{
						instanceTaskList
						.map((task, index) =>
							<TaskItem 
								key={index} 
								index={index} 
								task={task}
								onShowTaskDetails={(taskId) => {}}/>)
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
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam,
	SetQueryParams : QueryParamsActionsCreator.SetQueryParams
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(MainPage)