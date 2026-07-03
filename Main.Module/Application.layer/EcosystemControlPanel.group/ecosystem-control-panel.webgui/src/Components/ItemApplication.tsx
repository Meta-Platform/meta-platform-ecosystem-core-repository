import * as React from "react"

import {
    Card,
	CardContent,
	CardHeader,
	CardMeta
} from "semantic-ui-react"

import PackageIcon from "./PackageIcon"

const ItemApplication = ({
    applicationData,
    serverManagerInformation
}) => {

    const {
        executable,
        packageNamespace,
    } = applicationData

    const getPackageNamespaceBase = () => {
        const chunks = packageNamespace.split("/")
        return chunks[chunks.length-1]
    }

    return <Card style={{"width":"300px"}}>
                <CardContent>
                    <CardHeader style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <PackageIcon packageData={applicationData.packageData} serverManagerInformation={serverManagerInformation} size={22} fallbackIcon="terminal"/>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{executable}</span>
                    </CardHeader>
                    <CardMeta>{getPackageNamespaceBase()}</CardMeta>
                </CardContent>
            </Card>
}

export default ItemApplication
