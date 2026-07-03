import * as React from "react"

import { Icon, Image } from "semantic-ui-react"

import GetPackageIconURL from "../Utils/GetPackageIconURL"

const PackageIcon = ({ packageData, serverManagerInformation, size = 18, fallbackIcon = "file code outline" }:any) => {
    const iconURL = GetPackageIconURL({ serverManagerInformation, packageData })

    if(iconURL)
        return <Image src={iconURL} title="icone do pacote" style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain", flex: "0 0 auto", margin: 0 }}/>

    return <Icon name={fallbackIcon} style={{ color: "#888", flex: "0 0 auto" }}/>
}

export default PackageIcon
