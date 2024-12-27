import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const useFetchInstanceTaskList = ({
    monitoringStateKeySelected,
    HTTPServerManager
}) => {

    const [instanceTaskListSelected, setInstanceTaskListSelected] = useState([])

    useEffect(() => {

		if(monitoringStateKeySelected){
			setInstanceTaskListSelected([])
			fetchInstanceTasks()
		}
		
	}, [monitoringStateKeySelected])

    const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchInstanceTasks = () =>
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesSupervisor")
			.ListInstanceTasks({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setInstanceTaskListSelected(data))
    
    return instanceTaskListSelected
}

export default useFetchInstanceTaskList