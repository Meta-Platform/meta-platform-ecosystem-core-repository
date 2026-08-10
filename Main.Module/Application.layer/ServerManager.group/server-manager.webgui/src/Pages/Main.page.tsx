import * as React                   from "react"
import { useEffect, useState}       from "react"
import { connect }                  from "react-redux"
import { bindActionCreators }       from "redux"

import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import { Tabs } from "@i-components"

import GetRequestByServer  from "../Utils/GetRequestByServer"
import useQueryParamsState from "../Hooks/useQueryParamsState"

import WebServiceDetails    from "../Components/WebServiceDetails.component"
import ServerList           from "../List/Server.list"
import PanelServerContainer from "../Containers/PanelServer.container"

const getPaneByKey = (panes:Array<any>, key:string) =>
	panes.find(({menuItem}) => menuItem === key)

const MainPage = ({
	HTTPServerManager
}:any) => {

	const location = useLocation()
  	const navigate = useNavigate()

	const {
		queryParams,
		addQueryParam,
		removeQueryParam
	} = useQueryParamsState({location, navigate})

	const [webServersRequest, setRequest] = useState()
	const [status, setStatus] = useState<any>()

	const [webserverSelected, setWebserverSelected]   = useState()
	const [webserviceSelected, setWebserviceSelected] = useState()

	const [tabNameSelected, setTabNameSelected] = useState<string>()

	useEffect(() => setRequest(GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "HTTPServers")), [])

	useEffect(() => updateStatus(), [webServersRequest])

	useEffect(() => {
		if(tabNameSelected){
			addQueryParam("tab", tabNameSelected)
		}
	}, [tabNameSelected])

	const updateStatus = () => {
		if(webServersRequest){
			GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "HTTPServers")
			.Status()
			.then(({data}:any) => setStatus(data))
		}
	}

	const webServiceSelected =
		status
		&& webserverSelected
		&& webserviceSelected
		&& (status || [])
			.find(({name}:any) => webserverSelected === name)
			.listServices
			.find(({apiTemplate}:any) => apiTemplate && webserviceSelected === apiTemplate.name)

	const panes =
	[
		{
			menuItem: "Status",
			render: () =>
				<PanelServerContainer
					status        = {status}
					queryParams   = {queryParams}
					addQueryParam = {addQueryParam}/>
		},
		{
			menuItem: "Handle",
			render: () =>
				<div className="srv-split">
					<ServerList
						selected={{webserver:webserverSelected, webservice:webserviceSelected}}
						list={status || []}
						onSelectHTTPServer={()=>{}}
						onSelectService={({webservice, webserver}:any)=>{
							setWebserverSelected(webserver)
							setWebserviceSelected(webservice)
						}}/>
					{webServiceSelected && <WebServiceDetails webService={webServiceSelected}/>}
				</div>
		}
	]

	useEffect(() => {
		if(!queryParams.tab && panes && panes.length > 0)
			setTabNameSelected(panes[0].menuItem)
	}, [queryParams.tab])

	const activeKey  = (queryParams.tab as string) || tabNameSelected
	const activePane = getPaneByKey(panes, activeKey)

	return <div className="srv-page">
				<Tabs
					tabs      = {panes.map(({menuItem}) => ({ key: menuItem, label: menuItem }))}
					activeKey = {activeKey}
					onChange  = {(key:string) => setTabNameSelected(key)}/>
				<div className="srv-page__body">
					{ activePane && activePane.render() }
				</div>
			</div>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({

}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
	HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(MainPage)
