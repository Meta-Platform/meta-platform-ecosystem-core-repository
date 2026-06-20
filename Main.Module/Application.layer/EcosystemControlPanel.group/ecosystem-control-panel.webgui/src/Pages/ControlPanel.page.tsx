import * as React              from "react"
import { useEffect, useState } from "react"
import AnsiToHtml              from "ansi-to-html"
import { connect }             from "react-redux"
import {
	Container,
	Grid,
	Loader,
	Segment,
	Header,
	Button,
	Icon,
	Label
} from "semantic-ui-react"


const ansiConverter = new AnsiToHtml({
	fg: '#000',
	bg: '#fff',
	newline: true,
	escapeXML: true
  })

import { bindActionCreators } from "redux"
import qs                     from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import EcosystemNavigator from "../Components/EcosystemNavigator"

import GetAPI from "../Utils/GetAPI"

const Column = Grid.Column

import EnvironmentsContainer            from "../Containers/Environments.container"
import RepositoriesAndPackagesContainer from "../Containers/RepositoriesAndPackages.container"
import InstanceSupervisorContainer      from "../Containers/InstanceSupervisor.container"
import ExecutablesContainer             from "../Containers/Executables.container"
import ConfigFilesContainer             from "../Containers/ConfigFiles.container"
import EcosystemDataPathModal           from "../Modals/EcosystemDataPath.modal"

import useWebSocket from "../Hooks/useWebSocket"

import MainMenu from "../Components/MainMenu"
import ToastContainer from "../Components/ToastContainer"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const DEFAULT_PANEL = "instance supervisor"

const useNotificationManager = (serverManagerInformation) => {

	const [ notificationStateList, setNotificationStateList ] = useState<any[]>([])
	const [ nUnreadNotifications, setNUnreadNotifications ]    = useState<number>(0)

	const _GetNotificationAPI = () =>
		GetAPI({
			apiName:"Notification",
			serverManagerInformation
		})

	const _ReceiveNotification = (notification) =>
		setNotificationStateList((currentList) => {
			const newList = [ { wasSeen:false, payload:notification }, ...currentList ]
			setNUnreadNotifications(newList.filter(({ wasSeen }) => !wasSeen).length)
			return newList
		})

	const MarkAllAsSeen = () => {
		setNotificationStateList((currentList) =>
			currentList.map((notification) => ({ ...notification, wasSeen:true })))
		setNUnreadNotifications(0)
	}

	useWebSocket({
		socket          : _GetNotificationAPI().StreamNotifications,
		onMessage       : (notification) => _ReceiveNotification(notification),
		onConnection    : () => {},
		onDisconnection : () => {}
	})

	return {
		nUnreadNotifications,
		notificationStateList,
		MarkAllAsSeen
	}
}


const CardLog = ({
	date,
	type,
	origin,
	content
}) => {

	const messageHtml = ansiConverter.toHtml(content.message)

	return <Segment style={{"margin": "8px 0", padding:"10px"}}>
				<Label color="grey" size="small" attached='top right'>{date}</Label>
				<strong style={{fontSize: "medium"}}>{type.toUpperCase()} - {content.type.toUpperCase()} - {content.sourceName}</strong><br/>
				<Segment style={{"margin": "5px", padding:"8px", "color":"black"}}>
					<p dangerouslySetInnerHTML={{ __html: messageHtml }}></p>
				</Segment>
				<strong style={{ fontSize: ".85em", color: "grey" }}>{origin}</strong>
			</Segment>
}



const NotificationPanel = ({ onClose, notificationStateList }) => {
	return <Segment style={{margin: "15px"}}>
				<Button
							circular
							icon='close'
							basic
							floated="right"
							onClick={onClose} />
				<Header as='h3'>
					<Icon name='bell outline' />
					<Header.Content>Notifications</Header.Content>
				</Header>

				<div style={{ overflow: 'auto', maxHeight:"76vh" }}>
					{
						notificationStateList.length === 0
						&& <Segment placeholder textAlign="center" style={{ color: "grey" }}>
							<Icon name="bell slash outline" size="large"/>
							Sem notificações por enquanto
						</Segment>
					}
					{
						notificationStateList
						.map((notification, key) => {

							const {
								wasSeen,
								payload
							} = notification

							const {
								type,
								date,
								origin,
								content
							} = payload

							return <div key={key} style={{ opacity: wasSeen ? 0.7 : 1 }}>
								{
									type === "log"
									? CardLog({ date, type, origin, content })
									: <Segment style={{"margin": "8px 0", padding:"10px"}}>
											<Label color="grey" size="small" attached='top right'>{date}</Label>
											<strong style={{fontSize: "medium"}}>{type.toUpperCase()}</strong><br/>
											<Segment style={{"margin": "5px", padding:"8px", "color":"black"}}>
												<p dangerouslySetInnerHTML={{ __html:  ansiConverter.toHtml(typeof content === "string" ? content : JSON.stringify(content)) }}></p>
											</Segment>
											<strong style={{ fontSize: ".85em", color: "grey" }}>{origin}</strong>
										</Segment>
								}
							</div>
						})
					}
				</div>
			</Segment>
}

const ControlPanelPage = ({
	HTTPServerManager,
	QueryParams,
	AddQueryParam,
	RemoveQueryParam,
	SetQueryParams
}:any) => {

	const [isEcosystemDataPathModalOpen, setIsEcosystemDataPathModalOpen] = useState(false)
	const [ isLoading, setIsLoading ] = useState(true)

	const [ activeItem, setActiveItem ] = useState<string>()
	const [ ecosystemdataPathSelected, setEcosystemdataPathSelected ] = useState()

	const [ isOpenNotificationPanel, setIsOpenNotificationPanel] = useState(false)

	// responsividade: abaixo de ~992px a sidebar vira drawer (overlay).
	const [ isNarrow, setIsNarrow ] = useState<boolean>(typeof window !== "undefined" && window.innerWidth < 992)
	const [ isSidebarOpen, setIsSidebarOpen ] = useState<boolean>(false)

	useEffect(() => {
		const onResize = () => setIsNarrow(window.innerWidth < 992)
		window.addEventListener("resize", onResize)
		return () => window.removeEventListener("resize", onResize)
	}, [])

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
		}
		updateEcosystemdataPath()
	}, [])


	const _GetEcosystemdataAPI = () =>
        GetAPI({
            apiName:"EcosystemData",
            serverManagerInformation: HTTPServerManager
        })


	const {
		nUnreadNotifications,
		notificationStateList,
		MarkAllAsSeen
	} = useNotificationManager(HTTPServerManager)


	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])

	useEffect(() => {
		if(activeItem)
			AddQueryParam("panel", activeItem)
		else if(!activeItem && queryParams.panel)
			setActiveItem(queryParams.panel as string)
		else if(!activeItem && !queryParams.panel)
			setActiveItem(DEFAULT_PANEL)

	}, [activeItem])

	const updateEcosystemdataPath = async () => {
		const api = _GetEcosystemdataAPI()
		const response = await api.GetEcosystemDataPath()
		setEcosystemdataPathSelected(response.data)
		setIsLoading(false)
	}

	// Navegação central a partir do EcosystemNavigator. Usa SetQueryParams
	// (mesma primitiva idiomática dos outros painéis) para SUBSTITUIR toda a
	// query pelo estado do destino — isso limpa de uma vez os params de seleção
	// de outros painéis, que antes ficavam "grudados" e causavam comportamento
	// intermitente nos menus.
	const handleNavigate = ({ panel, params = {} }:any) => {
		setActiveItem(panel)

		const definedParams = Object.keys(params)
			.filter((key) => params[key] !== undefined)
			.reduce((acc:any, key:string) => ({ ...acc, [key]: params[key] }), {})

		SetQueryParams({ panel, ...definedParams })
	}

	const handleOpenEcosystemDataModal = () => setIsEcosystemDataPathModalOpen(true)
	const handleCloseEcosystemDataModal = () => setIsEcosystemDataPathModalOpen(false)

	const handleOpenNotificationPanel = () => {
		setIsOpenNotificationPanel(true)
		MarkAllAsSeen()
	}

	const handleCloseNotificationPanel = () => setIsOpenNotificationPanel(false)

	const navigatorSelection = {
		monitoringStateKey : QueryParams.monitoringStateKey,
		environmentName    : QueryParams.environmentName,
		tab                : QueryParams.tab,
		repo               : QueryParams.repo,
		configFileName     : QueryParams.configFileName,
		executableName     : QueryParams.executableName
	}

	const renderActivePanel = () => {
		switch(activeItem){
			case "environments":
				return <EnvironmentsContainer serverManagerInformation={HTTPServerManager}/>
			case "repositories":
				return <RepositoriesAndPackagesContainer
							serverManagerInformation={HTTPServerManager}
							activeTab={QueryParams.tab}
							onChangeTab={(tab:string) => AddQueryParam("tab", tab)}
							selectedRepo={QueryParams.repo}
							onSelectRepo={(repo:string) => AddQueryParam("repo", repo)}/>
			case "executables":
				return <ExecutablesContainer
							serverManagerInformation={HTTPServerManager}
							selectedExecutableName={QueryParams.executableName}
							onSelectExecutable={(name:string) => AddQueryParam("executableName", name)}
							onClearExecutable={() => RemoveQueryParam("executableName")}/>
			case "config files":
				return <ConfigFilesContainer
							serverManagerInformation={HTTPServerManager}
							configFileName={QueryParams.configFileName}/>
			case "instance supervisor":
			default:
				return <InstanceSupervisorContainer/>
		}
	}

	return isLoading
			? <Loader active style={{margin: "50px"}}/>
			:<div>
					<MainMenu
						nUnreadNotifications={nUnreadNotifications}
						ecosystemdataPath={ecosystemdataPathSelected}
						onClickOpenEcosystemDataPathModal={handleOpenEcosystemDataModal}
						onClickOpenNotificationPanel={handleOpenNotificationPanel}
						showSidebarToggle={isNarrow}
						onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}/>
					<Grid style={{ maxWidth: "1840px", margin: "0 auto" }}>
						{
							!isNarrow &&
							<Column width={3}>
								<EcosystemNavigator
									serverManagerInformation={HTTPServerManager}
									ecosystemdataPath={ecosystemdataPathSelected}
									activeItem={activeItem}
									selection={navigatorSelection}
									onNavigate={handleNavigate}/>
							</Column>
						}
						<Column width={isNarrow ? 16 : 13}>
							{ renderActivePanel() }
						</Column>
					</Grid>

					{
						/* Sidebar como DRAWER em telas estreitas (tablet). */
						isNarrow && isSidebarOpen && <>
							<div onClick={() => setIsSidebarOpen(false)}
								style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500 }}/>
							<div style={{
								position: "fixed", top: 0, left: 0, bottom: 0, width: "280px", maxWidth: "85vw",
								zIndex: 1600, background: "#fff", overflow: "auto", boxShadow: "3px 0 12px rgba(16,24,40,.18)", padding: "8px"
							}}>
								<EcosystemNavigator
									serverManagerInformation={HTTPServerManager}
									ecosystemdataPath={ecosystemdataPathSelected}
									activeItem={activeItem}
									selection={navigatorSelection}
									onNavigate={(target:any) => { handleNavigate(target); setIsSidebarOpen(false) }}/>
							</div>
						</>
					}

					{
						/* Notificações como OVERLAY: não empurra o conteúdo. */
						isOpenNotificationPanel &&
						<div style={{
							position: "fixed", top: "52px", right: 0, bottom: 0, width: "380px", maxWidth: "92vw",
							zIndex: 1000, background: "#ffffff",
							boxShadow: "-3px 0 12px rgba(16,24,40,.12)", borderLeft: "1px solid #e3e6ea", overflow: "auto"
						}}>
							<NotificationPanel
								onClose={handleCloseNotificationPanel}
								notificationStateList={notificationStateList}/>
						</div>
					}
					<EcosystemDataPathModal
						ecosystemdataPath={ecosystemdataPathSelected}
					 	open={isEcosystemDataPathModalOpen}
					 	onClose={() => handleCloseEcosystemDataModal()}/>

					<ToastContainer/>
			</div>

}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam    : QueryParamsActionsCreator.AddQueryParam,
	RemoveQueryParam : QueryParamsActionsCreator.RemoveQueryParam,
	SetQueryParams   : QueryParamsActionsCreator.SetQueryParams
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelPage)
