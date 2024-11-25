import * as React             from "react"
import { useEffect}           from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import PageDefault from "../Components/PageDefault"

import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const MainPage = ({
	HTTPServerManager,
	SetQueryParams,
	QueryParams,
	SetPackageDetails
}:any) => {

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
		}
	}, [])

	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])
	
	return <PageDefault>
	<ColumnGroup columns="three">
		{"teste"}
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