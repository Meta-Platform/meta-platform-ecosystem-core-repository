import * as React from "react"

import { Segment } from "semantic-ui-react"

import RenderValue from "../../Components/RenderValue"

const InstanceProcessInformation = ({
    processInformation
}) => {
    return <Segment>
        {
            Object.keys(processInformation)
            .map((paramName, key) => processInformation[paramName]
            ? <div key={key} style={{marginBottom:"10px"}}>
                    <strong>{paramName}</strong>
                    <RenderValue value={processInformation[paramName]}/>
                </div>
            : <></>)
        }
    </Segment>
}


export default InstanceProcessInformation