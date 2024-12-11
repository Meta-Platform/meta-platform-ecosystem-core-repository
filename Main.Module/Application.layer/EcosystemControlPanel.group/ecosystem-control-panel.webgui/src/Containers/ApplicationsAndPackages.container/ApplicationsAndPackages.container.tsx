import * as React              from "react"
import { useState, useEffect } from "react"
import { connect }             from "react-redux"
import { bindActionCreators }  from "redux"

import { 
	MenuItem,
	Label,
	TabPane, 
	Tab
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

    const mainPanes = [
		{
			menuItem: <MenuItem key='Tasks' style={{background: "aliceblue"}}>
							installed applications
					</MenuItem>,
		   render: () => 
			<TabPane style={{background: "aliceblue"}}>
				<ApplicationsList
                isLoading={isLoading}
                installedApplicationList={(installedApplicationListFiltered || installedApplicationList)}/>
			</TabPane>
		},
        {
			menuItem: <MenuItem key='Tasks' style={{background: "lightsteelblue"}}>
						installed packages
					</MenuItem>,
		   render: () => 
			<TabPane style={{background: "lightsteelblue"}}>
				dfghdfghdfghfg
			</TabPane>
		}
	]

    return  <Tab  style={{margin:"15px"}} panes={mainPanes} />
         
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({QueryParams}:any) => ({QueryParams})

export default connect(mapStateToProps, mapDispatchToProps)(ApplicationsAndPackagesContainer)