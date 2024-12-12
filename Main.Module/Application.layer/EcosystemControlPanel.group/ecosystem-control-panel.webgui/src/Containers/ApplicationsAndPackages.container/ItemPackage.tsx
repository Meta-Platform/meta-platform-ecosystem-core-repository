import * as React from "react"

import {  
    Label,
    Segment
} from "semantic-ui-react"


const ItemPackage = ({
    style,
    packageInformation
}) => {

    return <Segment style={style} >
                <Label size="mini">{packageInformation.ext.toUpperCase()}</Label>
                <br/>
                <p style={{marginTop: "5px"}}>
                   <i>{packageInformation.namespaceRepo}</i>{`.${packageInformation.moduleName}.${packageInformation.layerName}${packageInformation.parentGroup ? `.${packageInformation.parentGroup}`: ""}.`} <strong>{packageInformation.packageName}</strong>
                </p>
            
            </Segment>
}

export default ItemPackage