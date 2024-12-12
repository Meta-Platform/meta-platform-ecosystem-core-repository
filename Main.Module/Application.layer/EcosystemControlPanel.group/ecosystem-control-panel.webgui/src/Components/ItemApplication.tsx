import * as React from "react"

import {
    Icon,
    Card,
	CardContent,
	CardHeader,
	CardMeta
} from "semantic-ui-react"

const ItemApplication = ({
    applicationData,
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
                    <CardHeader><Icon name='terminal' /> {executable}</CardHeader>
                    <CardMeta>{getPackageNamespaceBase()}</CardMeta>
                </CardContent>
            </Card>
}

export default ItemApplication