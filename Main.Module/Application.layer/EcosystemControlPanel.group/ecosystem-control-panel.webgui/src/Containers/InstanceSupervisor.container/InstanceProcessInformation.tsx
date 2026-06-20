import * as React from "react"

import KeyValuePanel from "../../Components/KeyValuePanel"

const InstanceProcessInformation = ({
    processInformation
}) => <div style={{ padding: "4px 2px" }}><KeyValuePanel data={processInformation}/></div>

export default InstanceProcessInformation
