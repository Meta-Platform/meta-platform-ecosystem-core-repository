import * as React from "react"

import {
    Tab, 
    Loader,
    Dimmer,
    TabPane,
    CardGroup
} from "semantic-ui-react"

import ItemApplication from "../../Components/ItemApplication"

const ApplicationsList = ({
    isLoading,
    installedApplicationList
}) => {


    const panes = [
        {
            menuItem: 'command line application',
            render: () => <TabPane attached={false} style={{"backgroundColor": "mintcream"}}>
                                <CardGroup>
                                    {
                                        installedApplicationList
                                        .filter(({appType}) => appType === "CLI")
                                        .map((applicationData:any, key) => 
                                            <ItemApplication key={key} applicationData={applicationData}/>)
                                    }
                                </CardGroup>  
                        </TabPane>,
        },
        {
            menuItem: 'application',
            render: () => <TabPane attached={false} style={{"backgroundColor": "mistyrose"}}> 
                                <CardGroup>
                                    {
                                        installedApplicationList
                                        .filter(({appType}) => appType === "APP")
                                        .map((applicationData:any, key) => 
                                            <ItemApplication key={key} applicationData={applicationData}/>)
                                    }
                                </CardGroup>  
                        </TabPane>,
        }
    ]

    return isLoading ? <Dimmer active><Loader/></Dimmer>: <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
}

export default ApplicationsList