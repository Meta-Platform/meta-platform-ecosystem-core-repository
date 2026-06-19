import * as React from "react"

import { Segment } from "semantic-ui-react"

import KeyValuePanel from "../../Components/KeyValuePanel"

const StartupArguments = ({
    startupArguments
}) => <Segment><KeyValuePanel data={startupArguments}/></Segment>

export default StartupArguments
