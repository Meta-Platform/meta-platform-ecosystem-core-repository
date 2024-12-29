import * as React              from "react"
import { useState, useEffect } from "react"
import { connect }             from "react-redux"
import { bindActionCreators }  from "redux"

import { 
	MenuItem,
	TabPane, 
	Tab
 } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import ApplicationsTabs from "./ApplicationsTabs"
import PackageList from "./PackageList"

const ApplicationsAndPackagesContainer = ({ serverManagerInformation, QueryParams, AddQueryParam }:any) => {

    const [ installedApplicationList, setInstalledApplicationList ] = useState<any[]>([])
    const [ installedPackageList, setInstalledPackageList ] = useState<any[]>([])

    const [ installedApplicationListFiltered, setPackageListFiltered ] = useState<any[]>()
    const [ filterValue, setFilterValue ] = useState<string>()
    const [ isApplicationListLoading, setIsApplicationListLoading ] = useState(true)
    const [ isPackageListLoading, setIsPackageListLoading ] = useState(true)

    const _GetApplicationsAndPackagesAPI = () => 
        GetAPI({ 
            apiName:"ApplicationsAndPackages",  
            serverManagerInformation 
        })

    useEffect(() => {

        fetchInstalledApplicationList()
        fetchInstalledPackageList()

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
        const api = _GetApplicationsAndPackagesAPI()
        const response = await api.ListPackages()
        const installedPackageList = response.data
        setInstalledPackageList(installedPackageList)
        setIsPackageListLoading(false)
    }

    const fetchInstalledPackageList = async () => {
        const api = _GetApplicationsAndPackagesAPI()
        const response = await api.ListApplications()
        const installedApplicationList = response.data
        setInstalledApplicationList(installedApplicationList)
        setIsApplicationListLoading(false)
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
			menuItem: <MenuItem key='tasks' style={{background: "aliceblue"}}>
							installed applications
					</MenuItem>,
		   render: () => 
			<TabPane style={{background: "aliceblue"}}>
				<ApplicationsTabs
                    isLoading={isApplicationListLoading}
                    installedApplicationList={(installedApplicationListFiltered || installedApplicationList)}/>
			</TabPane>
		},
        {
			menuItem: <MenuItem key='tasks' style={{background: "lightsteelblue"}}>
						installed packages
					</MenuItem>,
		   render: () => 
			<TabPane style={{background: "lightsteelblue"}}>
				<PackageList 
                    packageList={installedPackageList}
                    isLoading={isPackageListLoading}/>
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