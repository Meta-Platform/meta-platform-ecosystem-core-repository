import {useEffect, useState}  from "react"

import { GetRequestByServer, ServerAppName } from "@i-components/net"

const useFetchInstanceTaskList = ({
    monitoringStateKeySelected,
    HTTPServerManager
}) => {

    const [instanceTaskListCurrent, setInstanceTaskListCurrent] = useState([])

    useEffect(() => {

		if(monitoringStateKeySelected){
			setInstanceTaskListCurrent([])
			fetchInstanceTasks()
		}
		
	}, [monitoringStateKeySelected])

    const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchInstanceTasks = () =>
		_GetWebservice(ServerAppName(), "InstancesSupervisor")
			.ListInstanceTasks({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setInstanceTaskListCurrent(data))
    
    return instanceTaskListCurrent
}

export default useFetchInstanceTaskList