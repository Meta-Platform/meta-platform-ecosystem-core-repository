import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const useFetchStartupArguments = ({
    monitoringStateKeySelected,
    HTTPServerManager
}) => {

    const [startupArgumentsCurrent, setStartupArgumentsCurrent] = useState()

    useEffect(() => {

		if(monitoringStateKeySelected){
			setStartupArgumentsCurrent(undefined)
			fetchInstanceTasks()
		}
		
	}, [monitoringStateKeySelected])

    const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchInstanceTasks = () =>
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesSupervisor")
			.ListInstanceTasks({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setStartupArgumentsCurrent(data))
    
    return startupArgumentsCurrent
}

export default useFetchStartupArguments