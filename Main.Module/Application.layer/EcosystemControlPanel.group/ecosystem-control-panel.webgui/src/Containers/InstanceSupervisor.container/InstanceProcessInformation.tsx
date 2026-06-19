import * as React from "react"

import { Segment } from "semantic-ui-react"

import KeyValuePanel from "../../Components/KeyValuePanel"

const InstanceProcessInformation = ({
    processInformation
}) => <Segment><KeyValuePanel data={processInformation}/></Segment>

export default InstanceProcessInformation
