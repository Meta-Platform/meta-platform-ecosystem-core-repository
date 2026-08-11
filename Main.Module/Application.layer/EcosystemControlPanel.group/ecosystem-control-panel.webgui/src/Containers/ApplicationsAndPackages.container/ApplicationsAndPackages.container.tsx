import * as React              from "react"
import { useState, useEffect } from "react"
import { connect }             from "react-redux"
import { bindActionCreators }  from "redux"

import { PageMasthead, Tabs } from "@i-components"

import { GetAPI } from "@i-components/net"

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

    // `Tabs` do kit é só a barra: o painel ativo é renderizado aqui embaixo.
    const [ activeTab, setActiveTab ] = useState<string>("applications")

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

    const tabs = [
        {
            key: "applications",
            label: "installed applications",
            icon: "rocket",
            count: (installedApplicationListFiltered || installedApplicationList).length
        },
        {
            key: "packages",
            label: "installed packages",
            icon: "cubes",
            count: installedPackageList.length
        }
    ]

    return <div className="ecp-apps-page">
        <PageMasthead
            icon="cubes"
            title="Applications & Packages"
            subtitle="what is installed in this ecosystem"/>

        <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab}/>

        {
            activeTab === "applications"
            ? <ApplicationsTabs
                isLoading={isApplicationListLoading}
                installedApplicationList={(installedApplicationListFiltered || installedApplicationList)}
                serverManagerInformation={serverManagerInformation}/>
            : <PackageList
                packageList={installedPackageList}
                isLoading={isPackageListLoading}
                serverManagerInformation={serverManagerInformation}/>
        }
    </div>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({QueryParams}:any) => ({QueryParams})

export default connect(mapStateToProps, mapDispatchToProps)(ApplicationsAndPackagesContainer)
