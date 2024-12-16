import * as React from "react"
import { useState, useEffect } from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Grid, Loader, Segment, List } from "semantic-ui-react"
import qs from "query-string"
import { 
	useNavigate
  } from "react-router-dom"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"
import GetAPI from "../../Utils/GetAPI"

import EnvironmentDetailsTab from "./EnvironmentDetailsTab"

const CleanEnvironmentName = environmentName => {
    const index = environmentName.lastIndexOf('-')
    return index !== -1 ? environmentName.slice(0, index) : environmentName
}

const EnvironmentsContainer = ({ 
    HTTPServerManager,
    AddQueryParam,
    QueryParams
 }:any) => {

    const [ environmentNameList, setEnviromentNameList ] = useState<any[]>([])
    const [ environmentNameSelected, setEnvironmentNameSelected ] = useState()
    const [ isLoading, setLoading ] = useState(true)

    const [ metadataHierarchySelected, setMetadataHierarchySelected] = useState()
    const [ executionParamsSelected, setExecutionParamsSelected] = useState()

  	const navigate = useNavigate()

    useEffect(() => {

        setMetadataHierarchySelected(undefined)
        setExecutionParamsSelected(undefined)
		if(environmentNameSelected){
			AddQueryParam("environmentName", environmentNameSelected)
            fetchMetadataHierarchy()
            fetchExecutionParams()
        }
		
	}, [environmentNameSelected])


    useEffect(() => {

		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})

		if(Object.keys(QueryParams).length > 0){
			if(QueryParams.environmentName)
				setEnvironmentNameSelected(QueryParams.environmentName)

		}

	}, [QueryParams])

    useEffect(() => {
        fetchEnvironmentsList()
    }, [])
    
    const getEnviromentAPI = () => 
        GetAPI({ 
            apiName:"Environments",  
            serverManagerInformation:HTTPServerManager
        })


    const fetchEnvironmentsList = async () => {
        const api = getEnviromentAPI()
        const response = await api.ListEnvironments()
        setEnviromentNameList(response.data)
        setLoading(false)
    }

    const fetchExecutionParams = async () => {
        const api = getEnviromentAPI()
        const response = await api.GetExecutionParams({environmentName: environmentNameSelected})
        setExecutionParamsSelected(response.data)
    }
    
    const fetchMetadataHierarchy = async () => {
        const api = getEnviromentAPI()
        const response = await api.GetMetadataHierarchy({environmentName: environmentNameSelected})
        setMetadataHierarchySelected(response.data)
    }

    const handleSelectEnvironment = (environmentName) => 
            setEnvironmentNameSelected(environmentName)
    
    return <Segment style={{margin:"15px", background: "lightblue"}}>
               {
                    isLoading && <Loader active style={{margin: "50px"}}/>
                }
                <Grid columns="two" divided>
					<Grid.Column width={3}>
                        <List selection animated>
                            {
                                environmentNameList
                                .map((environmentName:string, key:number) => 
                                <List.Item 
                                    active={environmentNameSelected && environmentName === environmentNameSelected}
                                    onClick={() => handleSelectEnvironment(environmentName)}>
                                    <List.Content>
                                        <List.Header>{CleanEnvironmentName(environmentName)}</List.Header>
                                    </List.Content>
                                </List.Item>)
                            }
                        </List>	
					</Grid.Column>
					<Grid.Column width={13}>
                        <EnvironmentDetailsTab
                            metadataHierarchy={metadataHierarchySelected}
                            executionParams={executionParamsSelected}/>
                    </Grid.Column>
				</Grid>
            </Segment>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam    : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(EnvironmentsContainer)