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
		notificationStateList.unshift({
			wasSeen:false,
			payload:notification
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
		nUnreadNotifications,
		notificationStateList
	}
}


const CardLog = ({
	date,
	type,
	content
}) => {

	const messageHtml = ansiConverter.toHtml(content.message)

	return <Segment secondary style={{"margin": "5px", padding:"8px", boxShadow: "1px 1px 1px black"}}>
				<Label color="grey" size="small" attached='top right'>{date}</Label>
				<strong style={{fontSize: "medium"}}>{type.toUpperCase()} - {content.type.toUpperCase()} - {content.sourceName}</strong><br/>
				<Segment style={{"margin": "5px", padding:"8px", "color":"black"}}>
					<p dangerouslySetInnerHTML={{ __html: messageHtml }}></p>
				</Segment>
				<strong>{origin}</strong>
			</Segment>
}
	


const NotificationPanel = ({ onClose, notificationStateList }) => {
	return <Segment style={{margin: "15px 15px 15px -20px", "backgroundColor": "lightsalmon"}}>
				<Button 
							circular 
							icon='close' 
							floated="right"
							onClick={onClose} />
				<Header as='h2' textAlign='center'>
					<Icon name='bell' />
					Notifications
				</Header>

				<div style={{ overflow: 'auto', maxHeight:"76vh" }}>
					{
						notificationStateList
						.map((notification) => {

							const {
								payload
							} = notification
							
							const {
								type,
								date,
								origin,
								content
							} = payload

							return type === "log" 
							? CardLog({
									date,
									type,
									content
								}) 
							:<Segment secondary style={{"margin": "5px", padding:"8px", boxShadow: "1px 1px 1px black"}}>
									<Label color="grey" size="small" attached='top right'>{date}</Label>
									<strong style={{fontSize: "medium"}}>{type.toUpperCase()}</strong><br/>
									<Segment style={{"margin": "5px", padding:"8px", "color":"black"}}>
										<p dangerouslySetInnerHTML={{ __html:  ansiConverter.toHtml(content) }}></p>
									</Segment>
									<strong>{origin}</strong>
								</Segment>
						})
					}
				</div>
			</Segment>
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
		nUnreadNotifications,
		notificationStateList
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

	const handleCloseNotificationPanel = () => setIsOpenNotificationPanel(false)

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
						<Column width={isOpenNotificationPanel ? 9 : 14}>
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
							&& <Column width={5}>
								<NotificationPanel 
									onClose={handleCloseNotificationPanel}
									notificationStateList={notificationStateList}/>
						</Column>
						}
					</Grid>
					<EcosystemDataPathModal
						ecosystemdataPath={ecosystemdataPathSelected}
					 	open={isEcosystemDataPathModalOpen}
					 	onClose={() => handleCloseEcosystemDataModal()}/>
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