import * as React from "react"
import { useState, useEffect } from "react"

import {
    List,
    ListItem,
    ListIcon,
    ListContent,
    ListHeader,
    ListDescription,
    Loader,
    Segment
} from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"

const ConfigurationsContainer = ({ serverManagerInformation }:any) => {

    const [ ecosystemDefault, setEcosystemDefault ] = useState<any[]>([])
    const [ isLoading, setIsLoading ] = useState(true)

    const _GetConfigurationsAPI = () => 
        GetAPI({ 
            apiName:"Configurations",  
            serverManagerInformation 
        })
    
    useEffect(() => {
        fetchEcosystemDefault()
    }, [])
    
    const fetchEcosystemDefault = async () => {
        try {
            const api = _GetConfigurationsAPI()
            const response = await api.GetDefaultEcosystemParameters()
            const ecosystemDefault = response.data
            setEcosystemDefault(ecosystemDefault)
            setIsLoading(false)

        }catch(e){
            console.log(e)
        }
    }

    return <Segment style={{margin:"1em"}}>
                {
                    isLoading 
                    ? <Loader active style={{margin: "50px"}}/>
                    : <List divided relaxed>
                           {
                                Object.keys(ecosystemDefault)
                                .map((paramName) => <ListItem>
                                                <ListIcon name='wrench' size='large' verticalAlign='middle' />
                                                <ListContent>
                                                    <ListHeader>{paramName}</ListHeader>
                                                    <ListDescription>{ecosystemDefault[paramName]}</ListDescription>
                                                </ListContent>
                                            </ListItem>)
                            }
                        </List>
                }
            </Segment>
}

export default ConfigurationsContainer