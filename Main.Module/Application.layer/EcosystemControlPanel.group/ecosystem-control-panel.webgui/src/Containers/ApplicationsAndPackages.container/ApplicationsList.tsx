import * as React from "react"

import {
    Segment, 
    Loader,
    Dimmer
} from "semantic-ui-react"

import ItemApplication from "../../Components/ItemApplication"

const ApplicationsList = ({
    isLoading,
    installedApplicationList
}) => {

    return <Segment placeholder>
                { isLoading && <Dimmer active><Loader/></Dimmer> }
                <div style={{ overflow: 'auto', height:"82vh" }}>
                    {
                        installedApplicationList
                        .map((applicationData:any, key) => 
                            <ItemApplication key={key} applicationData={applicationData}/>)
                    }
                </div>
            </Segment>
}

export default ApplicationsList