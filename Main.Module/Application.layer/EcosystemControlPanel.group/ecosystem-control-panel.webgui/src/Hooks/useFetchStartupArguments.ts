import {useEffect, useState}  from "react"

import { GetRequestByServer, ServerAppName } from "@i-components/net"

const useFetchStartupArguments = ({
    monitoringStateKeySelected,
    HTTPServerManager
}) => {

    const [startupArgumentsCurrent, setStartupArgumentsCurrent] = useState()

    useEffect(() => {

		if(monitoringStateKeySelected){
			setStartupArgumentsCurrent(undefined)
			fetchStartupArguments()
		}
		
	}, [monitoringStateKeySelected])

    const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchStartupArguments = () =>
		_GetWebservice(ServerAppName(), "InstancesSupervisor")
			.GetStartupArguments({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setStartupArgumentsCurrent(data))
    
    return startupArgumentsCurrent
}

export default useFetchStartupArguments