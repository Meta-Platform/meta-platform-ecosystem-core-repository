import * as React from "react"

import {
    Tab,
    TabPane,
    Loader
} from "semantic-ui-react"

import MetadataHierarchyDiagram from "./MetadataHierarchyDiagram"
import ExecutionPlanView from "./ExecutionPlanView"
import ExecutionPlanDiagram from "./ExecutionPlanDiagram"

const EnvironmentDetailsTab = ({
    metadataHierarchy,
    executionParams,
    onSaveExecutionParams
}) => {

    const panes = [
        {
            menuItem: 'execution plan',
            render: () => <TabPane>
                <ExecutionPlanView
                    executionParams={executionParams}
                    onSaveExecutionParams={onSaveExecutionParams}/>
            </TabPane>
        },
        {
            menuItem: 'diagram',
            render: () => <TabPane>
                {
                    executionParams
                    ? <ExecutionPlanDiagram executionParams={executionParams}/>
                    : <Loader/>
                }
            </TabPane>
        },
        {
            menuItem: 'metadata hierarchy',
            render: () => <TabPane>
                {
                    metadataHierarchy
                    ? <MetadataHierarchyDiagram metadataHierarchy={metadataHierarchy}/>
                    : <Loader/>
                }
            </TabPane>
        }
    ]

    return <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
}

export default EnvironmentDetailsTab