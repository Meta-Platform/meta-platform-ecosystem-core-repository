import * as React from "react"

import {
    Segment, 
    Loader,
    Dimmer
} from "semantic-ui-react"

import ItemPackage from "./ItemPackage"

const PackageList = ({
    isLoading,
    packageList
}) => {

    return <Segment placeholder>
                { isLoading && <Dimmer active><Loader/></Dimmer> }
                <div style={{ overflow: 'auto', height:"82vh" }}>
                    {
                        packageList
                        .map((packageInformation:any, key) => {
                                return <ItemPackage
                                            key={key}
                                            style={{marginRight:"15px"}}
                                            packageInformation={packageInformation}/>
                            })
                    }
                </div>
            </Segment>
}

export default PackageList