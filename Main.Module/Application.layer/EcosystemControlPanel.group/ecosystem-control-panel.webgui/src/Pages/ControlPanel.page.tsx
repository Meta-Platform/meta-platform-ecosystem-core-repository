import * as React              from "react"
import { useEffect, useState } from "react"

import { connect }             from "react-redux"
import { 
	Container, 
	Grid, 
	Loader
} from "semantic-ui-react"

import { bindActionCreators } from "redux"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import SidebarMenu from "../Components/SidebarMenu"

import GetAPI from "../Utils/GetAPI"

const Column = Grid.Column

import EnvironmentsContainer            from "../Containers/Environments.container"
import ApplicationsAndPackagesContainer from "../Containers/ApplicationsAndPackages.container"
import SourcesContainer                 from "../Containers/Sources.container"
import InstanceSupervisorContainer      from "../Containers/InstanceSupervisor.container"
import ConfigurationsContainer          from "../Containers/Configurations.container"
import EcosystemDataPathModal           from "../Modals/EcosystemDataPath.modal"

import useWebSocket from "../Hooks/useWebSocket"

import MainMenu from "../Components/MainMenu"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const useNotificationManager = (serverManagerInformation) => {

	const [ notificationStateList, setNotificationStateList ]= useState<any[]>([])

	const [ nUnreadNotifications, setNUnreadNotifications] = useState<number>(0)

	const _GetNotificationAPI = () => 
		GetAPI({ 
			apiName:"Notification",  
			serverManagerInformation 
		})


	const _RegisterNotification = (notification) => {
		notificationStateList.push({
			wasSeen:false,
			content:notification
		})

		setNotificationStateList(notificationStateList)
		setNUnreadNotifications(notificationStateList.length)
	}

	const _ReceiveNotification = (notification) =>
		_RegisterNotification(notification)

	useWebSocket({
		socket          : _GetNotificationAPI().StreamNotifications,
		onMessage       : (notification) => _ReceiveNotification(notification),
		onConnection    : () => {},
		onDisconnection : () => {}
	})

	return {
		nUnreadNotifications
	}
}

const ControlPanelPage = ({ 
	HTTPServerManager, 
	QueryParams,
	AddQueryParam,
	SetQueryParams
}:any) => {

	const [isEcosystemDataPathModalOpen, setIsEcosystemDataPathModalOpen] = useState(false)
	const [ isLoading, setIsLoading ] = useState(true)

	const [ activeItem, setActiveItem ] = useState<string>()
	const [ ecosystemdataPathSelected, setEcosystemdataPathSelected ] = useState()

	const [ isOpenNotificationPanel, setIsOpenNotificationPanel] = useState(false)

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
		nUnreadNotifications
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
		else 
			setActiveItem("packages")

	}, [activeItem])

	const updateEcosystemdataPath = async () => {
		const api = _GetEcosystemdataAPI()
		const response = await api.GetEcosystemDataPath()
		setEcosystemdataPathSelected(response.data)
		setIsLoading(false)
	}

	const handleSelectMenu = (activeItem) => setActiveItem(activeItem)

	const handleOpenEcosystemDataModal = () => setIsEcosystemDataPathModalOpen(true)
	const handleCloseEcosystemDataModal = () => setIsEcosystemDataPathModalOpen(false)

	const handleOpenNotificationPanel = () => setIsOpenNotificationPanel(true)

	return isLoading 
			? <Loader active style={{margin: "50px"}}/>
			:<Container fluid={true}>
					<MainMenu
						nUnreadNotifications={nUnreadNotifications}
						ecosystemdataPath={ecosystemdataPathSelected}
						onClickOpenEcosystemDataPathModal={handleOpenEcosystemDataModal}
						onClickOpenNotificationPanel={handleOpenNotificationPanel}/>
					<Grid>
						<Column  width={2}>
							<SidebarMenu
								onSelectMenu={handleSelectMenu}
								activeItem={activeItem}/>
						</Column>
						<Column width={isOpenNotificationPanel ? 8 : 14}>
							{
								activeItem === "instance supervisor"
								&& <InstanceSupervisorContainer/>
							}
							{
								activeItem === "applications and packages"
								&& <ApplicationsAndPackagesContainer serverManagerInformation={HTTPServerManager}/>
							}
							{
								activeItem === "environments"
								&& <EnvironmentsContainer serverManagerInformation={HTTPServerManager}/>
							}
							{
								activeItem === "repository sources"
								&& <SourcesContainer serverManagerInformation={HTTPServerManager}/>
							}
							{
								activeItem === "configs"
								&& <ConfigurationsContainer serverManagerInformation={HTTPServerManager}/>
							}

						</Column>
						
						{
							isOpenNotificationPanel
							&& <Column width={6}>
								NOTAS
						</Column>
						}
					</Grid>
					<EcosystemDataPathModal
						ecosystemdataPath={ecosystemdataPathSelected}
					 	open={isEcosystemDataPathModalOpen}
					 	onClose={()=> handleCloseEcosystemDataModal()}/>
			</Container>

}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam,
	SetQueryParams : QueryParamsActionsCreator.SetQueryParams
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelPage)