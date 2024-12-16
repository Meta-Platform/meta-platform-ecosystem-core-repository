import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const useFetchInstanceTaskList = ({
    socketFileNameSelected,
    HTTPServerManager
}) => {

    const [instanceTaskListSelected, setInstanceTaskListSelected] = useState([])

    useEffect(() => {

		if(socketFileNameSelected){
			setInstanceTaskListSelected([])
			fetchInstanceTasks()
		}
		
	}, [socketFileNameSelected])

    const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchInstanceTasks = () =>
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesMonitor")
			.ListInstanceTasks({ socketFilename:socketFileNameSelected})
			.then(({data}:any) => setInstanceTaskListSelected(data))
    
    return instanceTaskListSelected
}

export default useFetchInstanceTaskList