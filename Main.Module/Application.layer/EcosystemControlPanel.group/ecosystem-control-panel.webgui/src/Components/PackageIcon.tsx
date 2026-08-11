import * as React from "react"

import { Icon } from "@i-components"

import GetPackageIconURL from "../Utils/GetPackageIconURL"

const PackageIcon = ({ packageData, serverManagerInformation, size = 18, fallbackIcon = "file code outline" }:any) => {
    const iconURL = GetPackageIconURL({ serverManagerInformation, packageData })

    if(iconURL)
        return <img
            src={iconURL}
            alt=""
            title="icone do pacote"
            style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain", flex: "0 0 auto", margin: 0 }}/>

    return <Icon name={fallbackIcon} tone="muted" style={{ flex: "0 0 auto" }}/>
}

export default PackageIcon
