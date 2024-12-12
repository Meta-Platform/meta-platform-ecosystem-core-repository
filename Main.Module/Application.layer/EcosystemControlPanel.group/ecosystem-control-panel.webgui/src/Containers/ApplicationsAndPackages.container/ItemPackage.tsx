import * as React from "react"

import {  
    Header,
    Segment
} from "semantic-ui-react"


const ItemPackage = ({
    style,
    packageInformation
}) => {

    return <Segment style={style} >
                   <span style={{"color": "gray"}}><strong>{packageInformation.namespaceRepo}</strong><i>{`.${packageInformation.moduleName}.${packageInformation.layerName}${packageInformation.parentGroup ? `.${packageInformation.parentGroup}`: ""}`}</i></span>
                   <br/>
                   <strong style={{"fontSize": "large"}}>{packageInformation.packageName}.{packageInformation.ext}</strong>
            </Segment>
}

export default ItemPackage