import * as React from "react"
import { useState } from "react"

import { Grid, Loader } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import ApplicationDetails from "./ApplicationDetails"
import CardApplication from "./CardApplication"

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
    
    const getEnviromentAPI = () => 
        GetAPI({ 
            apiName:"Environment",  
            serverManagerInformation 
        })

    const fetchEnvironmentList = async () => {
        try {
            const api = getEnviromentAPI()
            const response = await api.ListEnvironments()
            const environmentsList = response.data
            setEnviromentList(environmentsList.filter(({ packageInService }:any) => packageInService))
            setLoading(false)
        }catch(e){
            console.log(e)
        }
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
                                                    <CardApplication
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