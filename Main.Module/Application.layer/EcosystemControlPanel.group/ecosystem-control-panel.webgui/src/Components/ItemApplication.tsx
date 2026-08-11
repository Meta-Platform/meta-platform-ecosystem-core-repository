import * as React from "react"

import { ObjectCard } from "@i-components"

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

    return <ObjectCard
                className="ecp-application-card"
                iconNode={
                    <PackageIcon
                        packageData={applicationData.packageData}
                        serverManagerInformation={serverManagerInformation}
                        size={22}
                        fallbackIcon="terminal"/>
                }
                title={executable}
                meta={getPackageNamespaceBase()}/>
}

export default ItemApplication
