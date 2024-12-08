import * as React from "react"

import {
    Label,
    Segment
} from "semantic-ui-react"

const ItemApplication = ({
    applicationData,
}) => {

    const {
        appType,
        executable,
        packageNamespace,
        repositoryNamespace,
        supervisorSocketFileName,
    } = applicationData

    return <Segment >
                <h2>{executable}</h2>
                <Label size="mini">{appType}</Label>
                
                <br/>
                <p style={{marginTop: "5px"}}>
                   <strong>{packageNamespace}</strong>
                </p>
                <p style={{marginTop: "5px"}}>
                   {repositoryNamespace}
                </p>
                <p style={{marginTop: "5px"}}>
                   <i>{supervisorSocketFileName}</i>
                </p>
            
            </Segment>
}

export default ItemApplication