import * as React from "react"
import { useState, useEffect } from "react"

import { Grid, Loader } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import ApplicationDetails from "./ApplicationDetails"
import CardEnvironment from "./CardEnvironment"

type PackageType = {
    namespaceRepo: string
    packageName: string
    moduleName: string
    layerName: string
    parentGroup: string
    ext: string
}

const EnvironmentsContainer = ({ serverManagerInformation }:any) => {

    const [ environmentsList, setEnviromentList ] = useState<PackageType[]>([])
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
        console.log(api)
        const response = await api.ListEnvironments()
        console.log(response)
        /*const environmentsList = response.data
        setEnviromentList(environmentsList.filter(({ packageInService }:any) => packageInService))
        setLoading(false)*/
    }

    const handleShowDetailsColumn = 
        (packageInformation) => 
        setPackageInfoSelected(packageInformation)

    return <Grid style={{padding:"1em"}}>
                {
                    isLoading && <Loader active style={{margin: "50px"}}/>
                }
                <Grid.Column width={ packageInfoSelected ? 8 : undefined}>
                    <Grid>
                        <Grid.Row>
                            {
                                environmentsList
                                .map((packageInformation:any, key) => {
                                        return <Grid.Column style={{marginBottom:"15px", width:"auto"}}>
                                                    <CardEnvironment
                                                        onShowDetailsColumn={handleShowDetailsColumn}
                                                        packageInformation={packageInformation}
                                                        serverManagerInformation={serverManagerInformation}/>
                                                </Grid.Column>
                                    })
                            }
                        </Grid.Row>
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