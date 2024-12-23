import * as React from "react"

import { CardGroup } from "semantic-ui-react"

import TaskInfoCard from "./TaskInfo.card"

const TaskCardGroup = ({tasklist}) => {

	const _GetApplicationInstanceCardData = () => {

		const data = tasklist.find(({objectLoaderType}) => objectLoaderType === "application-instance")

		if(data){
			return {
				taskId: data.taskId,
				label: "Application Instance Task",
				status: data.status,
				descriptionContent: <>
					<i style={{"color": "grey"}}>namespace</i><br/>
					<strong>{data.staticParameters.namespace}</strong>
				</>
			}
		}
		
	}

	const _GetServerManagerCardDataCardData = () => {
		const data = tasklist
			.find(({objectLoaderType, staticParameters}) => objectLoaderType === "service-instance" && staticParameters?.path === "Services/HTTPServer.service")

		if(data){

			const getURL = () => {
				if(isNaN(data.staticParameters.port)) return data.staticParameters.port
				else return <a href={`http://localhost:${data.staticParameters.port}`}>http://localhost:{data.staticParameters.port}</a>
			}
			
			return {
				taskId: data.taskId,
				label: "Server Manager Service Task",
				status: data.status,
				descriptionContent: <>
					<i style={{"color": "grey"}}>server name</i><br/>
					<strong>{data.staticParameters.name}</strong><br/>
					<strong>{getURL()}</strong>
				</>
			}
		}
	}

	const applicationInstanceCardData = _GetApplicationInstanceCardData()
	const serverManagerCardData = _GetServerManagerCardDataCardData()

	return <CardGroup>
                {applicationInstanceCardData && <TaskInfoCard data={applicationInstanceCardData}/>}
                {serverManagerCardData && <TaskInfoCard data={serverManagerCardData}/>}
        </CardGroup>
}


export default TaskCardGroup