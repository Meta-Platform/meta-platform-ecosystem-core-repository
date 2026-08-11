import * as React from "react"
import { useState } from "react"

import {
    EmptyState,
    SkeletonCards,
    Tabs
} from "@i-components"

import ItemApplication from "../../Components/ItemApplication"

const GroupDataListByRepositoryNamespace = (applicationList) => {
    return applicationList
    .reduce((acc, applicationData) => {

        if(!acc[applicationData.repositoryNamespace]){
            acc[applicationData.repositoryNamespace] = []
        }

        acc[applicationData.repositoryNamespace].push(applicationData)

        return acc
    }, {})
}

const ApplicationDataCardGroup = ({applicationList, serverManagerInformation}) => {

    const applicationDataGrouped = GroupDataListByRepositoryNamespace(applicationList)
    const repositoryNamespaceList = Object.keys(applicationDataGrouped)

    if(repositoryNamespaceList.length === 0)
        return <EmptyState
                    icon="rocket"
                    title="No application"
                    message="No installed application of this kind."/>

    return <>
        {
            repositoryNamespaceList
            .map((repositoryNamespace) => <div key={repositoryNamespace}>
                <div className="ecp-apps-group-head">
                    <span className="mp-panel__title">{repositoryNamespace}</span>
                    <span className="ecp-apps-group-head__count">
                        {applicationDataGrouped[repositoryNamespace].length}
                    </span>
                </div>
                <div className="ecp-apps-grid">
                    {
                        applicationDataGrouped[repositoryNamespace]
                        .map((applicationData:any, key) =>
                            <ItemApplication key={key} applicationData={applicationData} serverManagerInformation={serverManagerInformation}/>)
                    }
                </div>
            </div>)
        }
    </>
}

// `Tabs` do kit desenha só a barra — o painel do tipo escolhido é montado aqui.
const APP_TYPE_TABS = [
    { key: "APP", label: "standard application", icon: "rocket" },
    { key: "CLI", label: "command line application", icon: "terminal" }
]

const ApplicationsTabs = ({
    isLoading,
    installedApplicationList,
    serverManagerInformation
}) => {

    const [ activeAppType, setActiveAppType ] = useState<string>("APP")

    if(isLoading) return <SkeletonCards cards={6}/>

    const tabs = APP_TYPE_TABS.map((tab) => ({
        ...tab,
        count: installedApplicationList.filter(({appType}) => appType === tab.key).length
    }))

    return <>
        <Tabs tabs={tabs} activeKey={activeAppType} onChange={setActiveAppType}/>
        <div className="ecp-apps-tabpanel">
            <ApplicationDataCardGroup
                applicationList={installedApplicationList.filter(({appType}) => appType === activeAppType)}
                serverManagerInformation={serverManagerInformation}/>
        </div>
    </>
}

export default ApplicationsTabs
