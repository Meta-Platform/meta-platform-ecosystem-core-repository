import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

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
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesSupervisor")
			.ListInstanceTasks({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setInstanceTaskListCurrent(data))
    
    return instanceTaskListCurrent
}

export default useFetchInstanceTaskList