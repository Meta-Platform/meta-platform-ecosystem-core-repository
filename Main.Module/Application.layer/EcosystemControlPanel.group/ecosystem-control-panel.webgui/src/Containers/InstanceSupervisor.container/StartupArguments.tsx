import * as React from "react"


import { Segment, Divider } from "semantic-ui-react"

import RenderValue from "../../Components/RenderValue"

const StartupArguments = ({
    startupArguments
}) => {
    return <Segment>
        {
            Object.keys(startupArguments)
            .map((paramName, key) => startupArguments[paramName]
            ? <div key={key} style={{marginBottom:"10px"}}>
                    <strong>{paramName}</strong>
                    <RenderValue value={startupArguments[paramName]}/>
                </div>
            : <></>)
        }
    </Segment>
}


export default StartupArguments