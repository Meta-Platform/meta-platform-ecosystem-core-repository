import * as React from "react"
import { useState } from "react"

import {
    Segment,
    Button,
    ButtonGroup,
    Card,
    Loader,
    Tab,
    MenuItem
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

const RepositorySourceCard = ({
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

    const panes = [
        {
			menuItem: 
            <MenuItem key='tasks'>
                LOCAL_FS
            </MenuItem>,
			render: () => 
				<Tab.Pane>
					dfgdfgsdfg
				</Tab.Pane>
		}
    ]

    return <Card style={{"width":"400px", "padding":"15px"}}>
        {
            activeSourceData
            ? <>
                <strong style={{"fontSize": "large"}}>{repositoryNamespace}</strong>
                <Tab panes={panes} />
                <ButtonGroup>
                    <Button onClick={() => onOpenSwitchSource(repositoryNamespace)}>switch source</Button>
                    <Button primary loading={isUpdating} onClick={handleUpdateRepository}>update repository</Button>
                </ButtonGroup>
            </>
            : <Loader/>
        }
        
    </Card>
}

export default RepositorySourceCard