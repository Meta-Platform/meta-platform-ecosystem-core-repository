import * as React from "react"
import { useState } from "react"

import { Spinner, Tabs } from "@i-components"

import MetadataHierarchyDiagram from "./MetadataHierarchyDiagram"
import ExecutionPlanView from "./ExecutionPlanView"
import ExecutionPlanDiagram from "./ExecutionPlanDiagram"
import EnvironmentLogsTab from "./EnvironmentLogsTab"

// `Tabs` do kit é SÓ a barra: o estado da aba ativa e a renderização do painel
// são deste componente.
const TABS = [
    { key: "plan",     label: "execution plan",     icon: "list ol" },
    { key: "diagram",  label: "diagram",            icon: "sitemap" },
    { key: "metadata", label: "metadata hierarchy", icon: "code branch" },
    { key: "logs",     label: "logs",               icon: "file alternate outline" }
]

const EnvironmentDetailsTab = ({
    metadataHierarchy,
    executionParams,
    onSaveExecutionParams,
    serverManagerInformation,
    environmentName
}) => {

    const [ activeTab, setActiveTab ] = useState<string>("plan")

    const RenderPanel = () => {
        switch(activeTab){
            case "diagram":
                return executionParams
                    ? <ExecutionPlanDiagram executionParams={executionParams}/>
                    : <Spinner label="loading execution plan"/>
            case "metadata":
                return metadataHierarchy
                    ? <MetadataHierarchyDiagram metadataHierarchy={metadataHierarchy}/>
                    : <Spinner label="loading metadata hierarchy"/>
            case "logs":
                return <EnvironmentLogsTab
                    serverManagerInformation={serverManagerInformation}
                    environmentName={environmentName}/>
            default:
                return <ExecutionPlanView
                    executionParams={executionParams}
                    onSaveExecutionParams={onSaveExecutionParams}/>
        }
    }

    return <>
        <Tabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab}/>
        <div className="ecp-env-tabpanel">{RenderPanel()}</div>
    </>
}

export default EnvironmentDetailsTab
