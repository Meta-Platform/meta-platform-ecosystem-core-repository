import * as React from "react"

import {
    Divider,
    Icon,
    Card,
	CardContent,
	CardHeader,
	CardMeta,
	CardDescription,
} from "semantic-ui-react"

const ItemApplication = ({
    applicationData,
}) => {

    const {
        executable,
        packageNamespace,
        supervisorSocketFileName,
    } = applicationData

    const getPackageNamespaceBase = () => {
        const chunks = packageNamespace.split("/")
        return chunks[chunks.length-1]
    }

    return <Card style={{"width":"300px"}}>
                <CardContent>
                    <CardHeader><Icon name='terminal' /> {executable}</CardHeader>
                    <CardMeta>{getPackageNamespaceBase()}</CardMeta>
                    <CardDescription style={{"backgroundColor":"beige", "padding": "5px", border: "1px solid #c4c4c4"}}>
                        <i style={{ color: 'grey' }}>supervisor socket filename</i><br/>
                        <strong>{supervisorSocketFileName}</strong>
                    </CardDescription>
                </CardContent>
            </Card>
}

export default ItemApplication