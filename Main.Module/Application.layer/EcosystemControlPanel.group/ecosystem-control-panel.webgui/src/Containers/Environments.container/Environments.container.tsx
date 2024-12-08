import * as React from "react"
import { useState, useEffect } from "react"

import { Grid, Loader, Segment } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import ApplicationDetails from "./ApplicationDetails"

type PackageType = {
    namespaceRepo: string
    packageName: string
    moduleName: string
    layerName: string
    parentGroup: string
    ext: string
}

const EnvironmentsContainer = ({ serverManagerInformation }:any) => {

    const [ environmentNameList, setEnviromentNameList ] = useState<PackageType[]>([])
    const [ packageInfoSelected, setPackageInfoSelected ] = useState()
    const [ isLoading, setLoading ] = useState(true)

    useEffect(() => {
        fetchEnvironmentsList()
    }, [])
    
    
    const getEnviromentAPI = () => 
        GetAPI({ 
            apiName:"Environments",  
            serverManagerInformation 
        })
    const fetchEnvironmentsList = async () => {
        const api = getEnviromentAPI()
        const response = await api.ListEnvironments()
        setEnviromentNameList(response.data)
        setLoading(false)
    }

    return <Grid style={{padding:"1em"}}>
                {
                    isLoading && <Loader active style={{margin: "50px"}}/>
                }
                <Grid.Column width={ packageInfoSelected ? 8 : undefined}>
                    <Grid>
                        {
                                environmentNameList
                                .map((environmentName:any, key) => {
                                        return <Grid.Row>
                                                    <Segment>
                                                        <strong>{environmentName}</strong>
                                                    </Segment>
                                                </Grid.Row>
                                    })
                            }
                    </Grid>
                </Grid.Column>
                {
                    packageInfoSelected
                    && <Grid.Column width={8}>
                        <ApplicationDetails 
                            serverManagerInformation={serverManagerInformation}
                            packageInformation={packageInfoSelected}
                            onClose={() => setPackageInfoSelected(undefined)}/>
                    </Grid.Column>
                }
            </Grid>
}

export default EnvironmentsContainer