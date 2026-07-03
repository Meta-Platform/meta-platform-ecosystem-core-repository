import * as React              from "react"
import { useEffect, useState } from "react"
import AnsiToHtml              from "ansi-to-html"
import { connect }             from "react-redux"
import {
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

import EnvironmentsContainer            from "../Containers/Environments.container"
import RepositoriesAndPackagesContainer from "../Containers/RepositoriesAndPackages.container"
import InstanceSupervisorContainer      from "../Containers/InstanceSupervisor.container"
import ExecutablesContainer             from "../Containers/Executables.container"
import ConfigFilesContainer             from "../Containers/ConfigFiles.container"
import EcosystemDataPathModal           from "../Modals/EcosystemDataPath.modal"

import useWebSocket from "../Hooks/useWebSocket"

import MainMenu from "../Components/MainMenu"
import WelcomePanel from "../Components/WelcomePanel"
import ToastContainer from "../Components/ToastContainer"
import LogDock from "../Components/LogDock"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const DEFAULT_PANEL = "welcome"

// Título/ícone da seção ativa, mostrado no header superior (MainMenu) no lugar
// dos cabeçalhos que ficavam dentro de cada card.
const PANEL_TITLES:any = {
	"instance supervisor": { title: "Sockets de supervisor",  icon: "server" },
	"executables":         { title: "Executables",            icon: "terminal" },
	"environments":        { title: "Environments",           icon: "sitemap" },
	"repositories":        { title: "Repositories & Packages", icon: "cubes" },
	"config files":        { title: "Config Files",           icon: "cogs" }
}

const NOTIFICATION_TYPE_PROPS:any = {
	log       : { icon: "terminal", color: "grey" },
	message   : { icon: "info circle", color: "blue" },
	socket    : { icon: "plug", color: "teal" },
	source    : { icon: "feed", color: "orange" },
	package   : { icon: "cube", color: "violet" },
	repository: { icon: "cubes", color: "green" },
	error     : { icon: "warning sign", color: "red" }
}

const ToText = (value:any) => {
	if(value === undefined || value === null) return ""
	if(typeof value === "string") return value
	if(typeof value.message === "string") return value.message
	return JSON.stringify(value)
}

const GetNotificationPresentation = (payload:any) => {
	const content = payload?.content
	const logType = payload?.type === "log" ? content?.type : undefined
	const semanticType = logType === "error" ? "error" : payload?.type || "message"
	const props = NOTIFICATION_TYPE_PROPS[semanticType] || NOTIFICATION_TYPE_PROPS.message
	const title =
		content?.title ||
		(payload?.type === "log" ? `${content?.sourceName || "Log"} · ${(content?.type || "info").toUpperCase()}` : semanticType)
	const body = content?.message || ToText(content)

	return {
		...props,
		type: semanticType,
		title,
		body,
		origin: payload?.origin,
		date: payload?.date
	}
}

const ShouldShowDesktopNotification = (payload:any) =>
	payload?.type !== "log" || payload?.content?.type === "error"

const ShowDesktopNotification = (payload:any) => {
	if(!ShouldShowDesktopNotification(payload)) return
	const desktopNotifications = (window as any).electronNotifications
	if(!desktopNotifications || !desktopNotifications.show) return

	const notification = GetNotificationPresentation(payload)
	try {
		desktopNotifications.show({ title: notification.title, body: notification.body })
	} catch(e) {}
}

const useNotificationManager = (serverManagerInformation) => {

	const [ notificationStateList, setNotificationStateList ] = useState<any[]>([])
	const [ nUnreadNotifications, setNUnreadNotifications ]    = useState<number>(0)

	const _GetNotificationAPI = () =>
		GetAPI({
			apiName:"Notification",
			serverManagerInformation
		})

	const _ReceiveNotification = (notification) => {
		ShowDesktopNotification(notification)
		setNotificationStateList((currentList) => {
			const newList = [ { wasSeen:false, payload:notification }, ...currentList ]
			setNUnreadNotifications(newList.filter(({ wasSeen }) => !wasSeen).length)
			return newList
		})
	}

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


const NotificationPanel = ({ onClose, notificationStateList }) => {
	return <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
		<div style={{
			height: "56px", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between",
			padding: "0 14px", borderBottom: "1px solid #e7eaee", background: "#fff"
		}}>
			<Header as='h4' style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
				<Icon name='bell outline' />
				<Header.Content>Notifications</Header.Content>
			</Header>
			<Button circular icon='close' basic size="mini" onClick={onClose} />
		</div>

		<div style={{ overflow: 'auto', flex: "1 1 auto", padding: "12px", background: "#f6f8fa" }}>
			{
				notificationStateList.length === 0
				&& <Segment placeholder textAlign="center" style={{ color: "grey", minHeight: "160px" }}>
					<Icon name="bell slash outline" size="large"/>
					<div>Sem notificações por enquanto</div>
				</Segment>
			}
			{
				notificationStateList.map((notification, key) => {
					const { wasSeen, payload } = notification
					const view = GetNotificationPresentation(payload)
					const messageHtml = ansiConverter.toHtml(view.body)

					return <div
						key={key}
						style={{
							opacity: wasSeen ? 0.72 : 1,
							background: "#fff",
							border: "1px solid #e2e7ed",
							borderLeft: `4px solid ${view.color === "red" ? "#db2828" : view.color === "orange" ? "#f2711c" : view.color === "green" ? "#21ba45" : view.color === "violet" ? "#6435c9" : view.color === "teal" ? "#00b5ad" : "#767676"}`,
							borderRadius: "6px",
							padding: "10px 12px",
							marginBottom: "10px",
							boxShadow: "0 1px 2px rgba(16,24,40,.04)"
						}}>
						<div style={{ display: "flex", alignItems: "flex-start", gap: "8px", minWidth: 0 }}>
							<Icon name={view.icon} color={view.color} style={{ marginTop: "2px", flex: "0 0 auto" }}/>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
									<strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view.title}</strong>
									{ !wasSeen && <Label circular empty color="orange" size="mini" style={{ flex: "0 0 auto" }}/> }
								</div>
								<div style={{ color: "#4b5563", fontSize: ".9em", marginTop: "5px", wordBreak: "break-word" }}
									dangerouslySetInnerHTML={{ __html: messageHtml }}/>
								<div style={{ display: "flex", justifyContent: "space-between", gap: "8px", color: "#98a2b3", fontSize: ".78em", marginTop: "8px" }}>
									<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view.origin || "system"}</span>
									<span style={{ flex: "0 0 auto" }}>{view.date}</span>
								</div>
							</div>
						</div>
					</div>
				})
			}
		</div>
	</div>
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

	// responsividade: abaixo de ~1100px a sidebar vira drawer (overlay),
	// preservando espaço útil para os painéis em janelas menores.
	const [ isNarrow, setIsNarrow ] = useState<boolean>(typeof window !== "undefined" && window.innerWidth < 1100)
	const [ isSidebarOpen, setIsSidebarOpen ] = useState<boolean>(false)

	useEffect(() => {
		const onResize = () => {
			const nextIsNarrow = window.innerWidth < 1100
			setIsNarrow(nextIsNarrow)
			if(!nextIsNarrow) setIsSidebarOpen(false)
		}
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

	// Troca o endereço do EcosystemData e recarrega a UI, para que todos os
	// painéis (que resolvem o path dinamicamente no backend) reaponte para o
	// novo endereço.
	const handleChangeEcosystemDataPath = async (newPath:string) => {
		const api = _GetEcosystemdataAPI()
		await api.SetEcosystemDataPath({ path: newPath })
		window.location.reload()
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
		executableName     : QueryParams.executableName,
		executableType     : QueryParams.executableType,
		executableRepo     : QueryParams.executableRepo,
		executableStatus   : QueryParams.executableStatus
	}

	const renderActivePanel = () => {
		switch(activeItem){
			case "welcome":
				return <WelcomePanel onNavigate={handleNavigate} ecosystemdataPath={ecosystemdataPathSelected}/>
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
							selectedExecutableType={QueryParams.executableType}
							selectedExecutableRepo={QueryParams.executableRepo}
							selectedExecutableStatus={QueryParams.executableStatus}
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
			:<div className="eco-control-shell">
					<MainMenu
						nUnreadNotifications={nUnreadNotifications}
						ecosystemdataPath={ecosystemdataPathSelected}
						activePanelTitle={PANEL_TITLES[activeItem]?.title}
						activePanelIcon={PANEL_TITLES[activeItem]?.icon}
						onClickOpenEcosystemDataPathModal={handleOpenEcosystemDataModal}
						onClickOpenNotificationPanel={handleOpenNotificationPanel}
						onClickLogo={() => handleNavigate({ panel: "welcome" })}
						showSidebarToggle={isNarrow}
						onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}/>
					<div className="eco-control-body">
						{
							!isNarrow &&
							<aside className="eco-sidebar-fixed">
								<EcosystemNavigator
									serverManagerInformation={HTTPServerManager}
									ecosystemdataPath={ecosystemdataPathSelected}
									activeItem={activeItem}
									selection={navigatorSelection}
									onNavigate={handleNavigate}/>
							</aside>
						}
						<main className={isNarrow ? "eco-main-content eco-main-content-full" : "eco-main-content"}>
							{ renderActivePanel() }
						</main>
					</div>

					{
						/* Sidebar como DRAWER em telas estreitas (tablet). */
						isNarrow && isSidebarOpen && <>
							<div onClick={() => setIsSidebarOpen(false)}
								style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500 }}/>
							<div className="eco-sidebar-drawer">
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
							boxShadow: "-3px 0 12px rgba(16,24,40,.12)", borderLeft: "1px solid #e3e6ea", overflow: "hidden"
						}}>
							<NotificationPanel
								onClose={handleCloseNotificationPanel}
								notificationStateList={notificationStateList}/>
						</div>
					}
					<EcosystemDataPathModal
						ecosystemdataPath={ecosystemdataPathSelected}
					 	open={isEcosystemDataPathModalOpen}
					 	onClose={() => handleCloseEcosystemDataModal()}
						onChangePath={handleChangeEcosystemDataPath}/>

					<ToastContainer/>
					<LogDock/>
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
