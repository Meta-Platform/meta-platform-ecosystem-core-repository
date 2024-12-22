import * as React from "react"

import {
    Tab,
    TabPane,
    Loader
} from "semantic-ui-react"

import MetadataHierarchyDiagram from "./MetadataHierarchyDiagram"
//import ExecutionPlanDiagram from "./ExecutionPlanDiagram"
//<ExecutionPlanDiagram executionParams={executionParams}/>
const EnvironmentDetailsTab = ({
    metadataHierarchy,
    executionParams
}) => {

    const panes = [
        {
            menuItem: 'execution plan',
            render: () => <TabPane>
                {
                    executionParams
                    ? <span>sdfgdfg</span>
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