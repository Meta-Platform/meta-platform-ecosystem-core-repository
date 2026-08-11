import * as React                   from "react"
import { useEffect, useState}       from "react"
import { connect }                  from "react-redux"
import { bindActionCreators }       from "redux"

import { Tabs } from "@i-components"

import { GetRequestByServer, ServerAppName }   from "@i-components/net"

import WebServiceDetails    from "../Components/WebServiceDetails.component"
import ServerList           from "../List/Server.list"
import PanelServerContainer from "../Containers/PanelServer.container"

const getPaneByKey = (panes:Array<any>, key:string) =>
	panes.find(({menuItem}) => menuItem === key)

const HTTPServersContainer = ({
	queryParams,
	onChangeQueryParams,
	HTTPServerManager
}:any) => {

	const [webServersRequest, setRequest] = useState()
	const [status, setStatus]             = useState()

	const [webserverSelected, setWebserverSelected]   = useState()
	const [webserviceSelected, setWebserviceSelected] = useState()

	const [tabNameSelected, setTabNameSelected] = useState<string>()

	useEffect(() => setRequest(GetRequestByServer(HTTPServerManager, { ipc: false })(ServerAppName(), "HTTPServers")), [])

	useEffect(() => updateStatus(), [webServersRequest])

	useEffect(() => {
		if(tabNameSelected){
			onChangeQueryParams({
				...queryParams,
				tab:tabNameSelected
			})
		}
	}, [tabNameSelected])

	const updateStatus = () => {
		if(webServersRequest){
			GetRequestByServer(HTTPServerManager, { ipc: false })(ServerAppName(), "HTTPServers")
			.Status()
			.then(({data}:any) => setStatus(data))
		}
	}

	const webServiceSelected =
		status
		&& webserverSelected
		&& webserviceSelected
		&& (status || [])
		//@ts-ignore
			.find(({name}:any) => webserverSelected === name)
			.listServices
			.find(({apiTemplate}:any) => apiTemplate && webserviceSelected === apiTemplate.name)

	const panes =
	[
		{
			menuItem: "Status",
			render: () =>
				<PanelServerContainer
					status              = {status}
					queryParams         = {queryParams}
					onChangeQueryParams = {onChangeQueryParams}/>
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

	const activeKey  = queryParams.tab || tabNameSelected
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
export default connect(mapStateToProps, mapDispatchToProps)(HTTPServersContainer)
