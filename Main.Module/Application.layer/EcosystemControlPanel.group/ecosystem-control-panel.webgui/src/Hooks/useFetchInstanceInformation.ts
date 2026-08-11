import {useEffect, useState}  from "react"

import { GetRequestByServer, ServerAppName } from "@i-components/net"

const useFetchInstanceInformation = ({
    monitoringStateKeySelected,
    HTTPServerManager
}) => {

    const [processInformation, setProcessInformation] = useState()

    useEffect(() => {

		if(monitoringStateKeySelected){
			setProcessInformation(undefined)
			fetchProcessInformation()
		}
		
	}, [monitoringStateKeySelected])

    const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchProcessInformation = () =>
		_GetWebservice(ServerAppName(), "InstancesSupervisor")
			.GetProcessInformation({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setProcessInformation(data))
    
    return processInformation
}

export default useFetchInstanceInformation