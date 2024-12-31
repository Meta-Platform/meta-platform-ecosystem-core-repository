import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

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
		_GetWebservice(process.env.SERVER_APP_NAME, "InstancesSupervisor")
			.GetProcessInformation({ monitoringStateKey:monitoringStateKeySelected})
			.then(({data}:any) => setProcessInformation(data))
    
    return processInformation
}

export default useFetchInstanceInformation