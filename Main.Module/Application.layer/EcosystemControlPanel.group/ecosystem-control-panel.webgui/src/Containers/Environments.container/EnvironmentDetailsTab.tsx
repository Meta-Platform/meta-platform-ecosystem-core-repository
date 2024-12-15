import * as React from "react"

import {
    Tab,
    TabPane,
    Loader
} from "semantic-ui-react"

import MetadataHierarchyDiagram from "./MetadataHierarchyDiagram"

const EnvironmentDetailsTab = ({
    metadataHierarchy
}) => {

    const panes = [
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