import * as React             from "react"
import {useEffect, useState}  from "react"

import useWebSocket from "../../Hooks/useWebSocket"

import { 
	Label,
	Segment,
	Divider,
	CardGroup,
	Card,
	CardContent,
	CardMeta
 } from "semantic-ui-react"

const OverviewSocketPanel = ({
	supervisorAPI,
	onSelect
}) => {

	const [overview, setOverview] = useState({})

	useEffect(() => {
		fetchOverview()
	}, [])


    useWebSocket({
		socket          : supervisorAPI.InstanceOverviewChange,
		onMessage       : (newOverview) => console.log(newOverview),
		onConnection    : () => {},
		onDisconnection : () => {}
	})

	const fetchOverview = () => 
		supervisorAPI
		.Overview()
		.then(({data}:any) => setOverview(data))

	return <Segment style={{margin:"15px", background: "antiquewhite"}}>
                <h1>Overview</h1>
                <Divider/>
                <CardGroup>
                    {
                        Object.keys(overview)
                        .map((monitoringStateKey) => {
                            const monitoringStateInformation = overview[monitoringStateKey]
                            return <Card disabled onClick={() => onSelect(monitoringStateKey)} style={{"width":"600px"}}>
                                        <Label attached='top' color="pink">{monitoringStateInformation.status}</Label>
                                        <CardContent>
                                            <CardMeta>{monitoringStateKey}</CardMeta>
                                        </CardContent>
                                    </Card>
                        })
                    }
                </CardGroup>
            </Segment>
}

export default OverviewSocketPanel