import * as React from "react"
import { useState } from "react"

import {
    Segment,
    Button,
    ButtonGroup,
    Card
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

const RepositoryNamespaceCard = ({
    repositoryNamespace,
    serverManagerInformation,
    activeSourceList,
    onOpenSwitchSource
}) => {

    const [ isUpdating, setIsUpdating ] = useState(false)

    const activeSourceData = activeSourceList
        .find((activeSourceData) => activeSourceData.repositoryNamespace === repositoryNamespace)

    const _GetSourcesAPI = () => 
        GetAPI({ 
            apiName:"Sources",  
            serverManagerInformation 
        })

    const UpdateRepository = async () => {
        try {
            setIsUpdating(true)
            const api = _GetSourcesAPI()
            await api.UpdateRepository({repositoryNamespace})
            setIsUpdating(false)
        }catch(e){
            console.log(e)
            setIsUpdating(false)
        }
    }

    const handleUpdateRepository = () => UpdateRepository()

    return <Card style={{"width":"400px", "padding":"15px"}}>
        <strong style={{"fontSize": "large"}}>{repositoryNamespace}</strong>
        <Segment style={{"backgroundColor": "aliceblue"}}>
            {
                Object
                .keys(activeSourceData.sourceData)
                .filter((property) => property !== "repositoryNamespace")
                .map((property) => <p>{property}<br/><strong>{activeSourceData.sourceData[property]}</strong></p>)
            }
        </Segment>
        <ButtonGroup>
            <Button onClick={() => onOpenSwitchSource(repositoryNamespace)}>switch source</Button>
            <Button primary loading={isUpdating} onClick={handleUpdateRepository}>update repository</Button>
        </ButtonGroup>
    </Card>
}

export default RepositoryNamespaceCard