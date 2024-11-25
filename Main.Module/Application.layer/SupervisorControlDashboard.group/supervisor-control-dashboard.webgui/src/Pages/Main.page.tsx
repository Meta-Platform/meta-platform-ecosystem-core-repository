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

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
			updateSocketFileList()
		}
	}, [])

	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])
	
	const _GetWebservice = GetRequestByServer(HTTPServerManager)

	const updateSocketFileList = () => {
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
		.ListSockets()
		.then(({data}:any) => {
			setSocketFileList(data) 
		})
	}

	return <PageDefault>
	<ColumnGroup columns="three">
		<Column width={4}>
		<SocketFileList
			list={socketFileList}/>
		</Column>
		<Column width={12}>
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