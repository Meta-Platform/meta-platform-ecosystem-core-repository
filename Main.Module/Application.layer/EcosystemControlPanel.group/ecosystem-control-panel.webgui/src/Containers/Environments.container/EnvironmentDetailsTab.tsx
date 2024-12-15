import * as React from "react"

import {
    Tab,
    TabPane,
    Loader
} from "semantic-ui-react"

import DependencyDiagram from "./DependencyDiagram"

const EnvironmentDetailsTab = ({
    metadataHierarchy
}) => {

    const panes = [
        {
            menuItem: 'metadata hierarchy',
            render: () => <TabPane>
                {
                    metadataHierarchy
                    ? <DependencyDiagram metadataHierarchy={metadataHierarchy}/>
                    : <Loader/>
                }
            </TabPane>
        }
    ]

    return <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
}

export default EnvironmentDetailsTab