import * as React              from "react"
import { useState, useEffect } from "react"
import { connect }             from "react-redux"
import { bindActionCreators }  from "redux"

import {
    Grid,
    Input,
    ButtonGroup
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import ApplicationsList from "./ApplicationsList"

const ApplicationsAndPackagesContainer = ({ serverManagerInformation, QueryParams, AddQueryParam }:any) => {

    const [ installedApplicationList, setInstalledApplicationList ] = useState<any[]>([])
    const [ installedApplicationListFiltered, setPackageListFiltered ] = useState<any[]>()
    const [ filterValue, setFilterValue ] = useState<string>()
    const [ isLoading, setIsLoading ] = useState(true)

    const _GetApplicationsAndRepositoriesAPI = () => 
        GetAPI({ 
            apiName:"ApplicationsAndRepositories",  
            serverManagerInformation 
        })

    useEffect(() => {

        fetchInstalledApplicationList()

        if(QueryParams.filterValue)
            setFilterValue(QueryParams.filterValue)

    }, [])

    useEffect(() => {

        if(installedApplicationList){
            if(installedApplicationListFiltered){
                filterInstalledApplicationList()
            }
        }

    }, [installedApplicationList])

    useEffect(() => {
        if(filterValue){
            filterInstalledApplicationList()
            AddQueryParam("filterValue", filterValue)
        }
    }, [filterValue])

    const fetchInstalledApplicationList = async () => {
        const api = _GetApplicationsAndRepositoriesAPI()
        const response = await api.ListInstalledApplications()
        const installedApplicationList = response.data
        setInstalledApplicationList(installedApplicationList)
        setIsLoading(false)
    }
    
    const filterInstalledApplicationList = () => {
        const filteredList = installedApplicationList
        .filter(({repositoryParams}:any) => {
            return Object.values(repositoryParams).some(param => 
                param.toString().toLowerCase().includes(filterValue.toLowerCase())
            )
        })
        setPackageListFiltered(filteredList)
    }

    const handleFilterInstalledApplicationList = (filterValue:string) => setFilterValue(filterValue)

    return <Grid style={{padding:"1em"}}>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Grid.Row>
                            <Input 
                                icon='filter' 
                                placeholder='package filter' 
                                value={filterValue}
                                onChange={({target:{value}}) => handleFilterInstalledApplicationList(value)}
                                />
                                <ButtonGroup
                                    floated="right"
                                    buttons={[
                                        { key: 'card-view', icon: 'th' },
                                        { key: 'list-view', icon: 'th list' }
                                    ]}/>
                        </Grid.Row>
                        <ApplicationsList
                            isLoading={isLoading}
                            installedApplicationList={(installedApplicationListFiltered || installedApplicationList)}/>
                    </Grid.Column>
                  
                    
                </Grid.Row>
            </Grid>
         
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({QueryParams}:any) => ({QueryParams})

export default connect(mapStateToProps, mapDispatchToProps)(ApplicationsAndPackagesContainer)