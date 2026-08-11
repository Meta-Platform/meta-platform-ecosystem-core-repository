import * as React              from "react"
import { useEffect, useState } from "react"
import { connect }             from "react-redux"
import {
	AppShell,
	Badge,
	EmptyState,
	Icon,
	IconButton,
	Spinner,
	StatusChip,
	StatusStrip
} from "@i-components"
// O corpo da notificação vem com sequências ANSI (a saída do processo). O kit
// as interpreta com `ParseAnsi`, devolvendo pedaços já mapeados nos tokens
// --mp-terminal-*. Antes isto era `ansi-to-html`, que emitia hexadecimal fixo
// ('#000'/'#fff') dentro de um dangerouslySetInnerHTML: a cor não seguia o tema
// e o texto do processo virava marcação.
import { ParseAnsi } from "@i-components/components/advanced/runtime"

const AnsiText = ({ text }:{ text:string }) => <>
	{
		ParseAnsi(text || "").map((segment:any, index:number) => <span
			key={index}
			style={{ color: segment.color, background: segment.background, fontWeight: segment.bold ? 700 : undefined }}>
			{segment.text}
		</span>)
	}
</>

import { bindActionCreators } from "redux"
import qs                     from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import EcosystemNavigator from "../Components/EcosystemNavigator"

import { GetAPI } from "@i-components/net"
import BrowserLog from "../Utils/BrowserLog"

import EnvironmentsContainer            from "../Containers/Environments.container"
import RepositoriesAndPackagesContainer from "../Containers/RepositoriesAndPackages.container"
import InstanceSupervisorContainer      from "../Containers/InstanceSupervisor.container"
import ExecutablesContainer             from "../Containers/Executables.container"
import ConfigFilesContainer             from "../Containers/ConfigFiles.container"
import LogsContainer                    from "../Containers/Logs.container"
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
	"instance supervisor": { title: "Supervisor Sockets",  icon: "server" },
	"executables":         { title: "Executables",            icon: "terminal" },
	"environments":        { title: "Environments",           icon: "sitemap" },
	"repositories":        { title: "Repositories & Packages", icon: "cubes" },
	"config files":        { title: "Config Files",           icon: "cogs" },
	"logs":                { title: "Logs",                   icon: "file alternate outline" }
}

// Apresentação por tipo de notificação: ícone, cor do ícone (o `color` do kit
// já resolve cada nome para um token --mp-*) e a faixa de severidade do card,
// que vem por classe (.ecp-notif-card--*) para não ter cor literal no TSX.
const NOTIFICATION_TYPE_PROPS:any = {
	log       : { icon: "terminal",     color: "grey",   stripe: "neutral" },
	message   : { icon: "info circle",  color: "blue",   stripe: "info" },
	socket    : { icon: "plug",         color: "teal",   stripe: "cyan" },
	source    : { icon: "feed",         color: "orange", stripe: "orange" },
	package   : { icon: "cube",         color: "violet", stripe: "violet" },
	repository: { icon: "cubes",        color: "green",  stripe: "success" },
	error     : { icon: "warning sign", color: "red",    stripe: "danger" }
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


// Bucket de filtro por severidade/origem.
const NotificationBucket = (payload:any) => {
	const view = GetNotificationPresentation(payload)
	if(view.type === "error") return "errors"
	if(payload?.type === "log") return "runtime"
	return "system"
}

// Colapsa itens consecutivos idênticos (mesmo título + corpo) num só card com
// contador — reduz ruído de eventos repetidos (§9.9).
const GroupConsecutive = (list:any[]) => {
	const out:any[] = []
	list.forEach((n:any) => {
		const view = GetNotificationPresentation(n.payload)
		const sig = `${view.title}∆${view.body}`
		const last = out[out.length - 1]
		if(last && last.sig === sig) {
			last.count += 1
			last.wasSeen = last.wasSeen && n.wasSeen
		} else {
			out.push({ sig, view, count: 1, wasSeen: n.wasSeen })
		}
	})
	return out
}

const NOTIF_FILTERS:any = [
	{ key: "all",     label: "all" },
	{ key: "errors",  label: "errors",  tone: "danger" },
	{ key: "runtime", label: "runtime", tone: "info" },
	{ key: "system",  label: "system" }
]

// Gaveta de notificações (§3 do ui-style-guide): cabeçalho paper-2 com borda
// forte, chips de filtro, cards com faixa de severidade, agrupamento de
// repetidos e line-clamp de 3 linhas no corpo.
const NotificationPanel = ({ onClose, notificationStateList }) => {

	const [ filter, setFilter ] = useState<string>("all")

	const counts = notificationStateList.reduce((acc:any, n:any) => {
		const b = NotificationBucket(n.payload); acc[b] = (acc[b] || 0) + 1; return acc
	}, {})

	const filtered = filter === "all"
		? notificationStateList
		: notificationStateList.filter((n:any) => NotificationBucket(n.payload) === filter)
	const grouped = GroupConsecutive(filtered)

	return <aside className="mp-offcanvas ecp-notif-drawer" role="dialog" aria-label="Notifications">
		<header className="ecp-notif-drawer__head">
			<span className="ecp-notif-drawer__title">
				<Icon name="bell outline"/>
				Notifications
			</span>
			<IconButton icon="close" label="close notifications" size="sm" onClick={onClose}/>
		</header>

		{/* chips de filtro */}
		<StatusStrip className="ecp-notif-drawer__filters">
			{
				NOTIF_FILTERS.map((f:any) => {
					const n = f.key === "all" ? notificationStateList.length : (counts[f.key] || 0)
					return <StatusChip key={f.key} tone={f.tone || "neutral"} count={n} label={f.label}
						active={filter === f.key} onClick={() => setFilter(f.key)}/>
				})
			}
		</StatusStrip>

		<div className="ecp-notif-drawer__list">
			{
				grouped.length === 0
				&& <EmptyState icon="bell slash outline" message="No notifications yet"/>
			}
			{
				grouped.map((g:any, key:number) => {
					const view = g.view
					return <article
						key={key}
						className={`ecp-notif-card ecp-notif-card--${view.stripe} ${g.wasSeen ? "is-seen" : ""}`.trim()}>
						<Icon name={view.icon} color={view.color} className="ecp-notif-card__icon"/>
						<div className="ecp-notif-card__body">
							<div className="ecp-notif-card__titleline">
								<strong className="ecp-notif-card__title">{view.title}</strong>
								{ g.count > 1 && <Badge className="ecp-notif-card__count">×{g.count}</Badge> }
								{ !g.wasSeen && <span className="ecp-notif-card__dot" aria-label="unread"/> }
							</div>
							<div className="ecp-notif-card__message" title={view.body}>
								<AnsiText text={view.body}/>
							</div>
							<div className="ecp-notif-card__foot">
								<span className="ecp-notif-card__origin">{view.origin || "system"}</span>
								<span className="ecp-notif-card__date">{view.date}</span>
							</div>
						</div>
					</article>
				})
			}
		</div>
	</aside>
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

	/*
	 * Liga o log do navegador assim que o painel sabe com qual servidor falar.
	 * A partir daqui, erro de tela e `BrowserLog.*` ficam gravados no log da
	 * aplicação, com origin "browser".
	 */
	useEffect(() => {
		if(HTTPServerManager) BrowserLog.Install(HTTPServerManager)
	}, [ HTTPServerManager ])

	const renderActivePanel = () => {
		switch(activeItem){
			case "welcome":
				return <WelcomePanel onNavigate={handleNavigate} ecosystemdataPath={ecosystemdataPathSelected} serverManagerInformation={HTTPServerManager}/>
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
			case "logs":
				return <LogsContainer serverManagerInformation={HTTPServerManager}/>
			case "instance supervisor":
			default:
				return <InstanceSupervisorContainer/>
		}
	}

	const renderNavigator = (onNavigateTarget:any) =>
		<EcosystemNavigator
			serverManagerInformation={HTTPServerManager}
			ecosystemdataPath={ecosystemdataPathSelected}
			activeItem={activeItem}
			selection={navigatorSelection}
			onNavigate={onNavigateTarget}/>

	return isLoading
			? <div className="ecp-boot"><Spinner label="loading control panel…"/></div>
			: <>
					<AppShell
						topbar={
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
						}
						sidebar={
							!isNarrow
								? <div className="ecp-sidebar">{ renderNavigator(handleNavigate) }</div>
								: undefined
						}>
						{ renderActivePanel() }
					</AppShell>

					{
						/* Sidebar como DRAWER em telas estreitas (tablet). */
						isNarrow && isSidebarOpen && <>
							<div className="mp-offcanvas__scrim ecp-nav-drawer__scrim" onClick={() => setIsSidebarOpen(false)}/>
							<aside className="mp-offcanvas mp-offcanvas--left ecp-nav-drawer">
								{ renderNavigator((target:any) => { handleNavigate(target); setIsSidebarOpen(false) }) }
							</aside>
						</>
					}

					{
						/* Notificações como OVERLAY: não empurra o conteúdo. */
						isOpenNotificationPanel &&
						<NotificationPanel
							onClose={handleCloseNotificationPanel}
							notificationStateList={notificationStateList}/>
					}

					<EcosystemDataPathModal
						ecosystemdataPath={ecosystemdataPathSelected}
					 	open={isEcosystemDataPathModalOpen}
					 	onClose={() => handleCloseEcosystemDataModal()}
						onChangePath={handleChangeEcosystemDataPath}/>

					<ToastContainer/>
					<LogDock/>
			</>

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
