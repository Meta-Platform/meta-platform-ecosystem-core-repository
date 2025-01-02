import * as React from "react"
import { useState, useEffect } from "react"

import {
    Loader,
    Segment,
    Menu,
    MenuMenu,
    MenuItem,
    Button,
    ButtonGroup,
    CardGroup,
    Card
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

import SwitchSourceModal from "../../Modals/SwitchSource.modal"

import SourceParamsTable from "./SourceParams.table"

import RepositorySourceCard from "./RepositorySource.card"

const GroupSources = (sourceList) => {

    return sourceList.reduce((acc, source) => {

        if(!acc[source.repositoryNamespace]){
            acc[source.repositoryNamespace] = []
        }

        acc[source.repositoryNamespace].push(source)

        return acc
    }, {})
}

const RepositorySourcesContainer = ({ serverManagerInformation }:any) => {

    const [ sourceList, setSourceList ] = useState<any[]>([])
    const [ activeSourceList, setActiveSourceList ] = useState<any[]>([])
    const [ isLoading, setIsLoading ] = useState(true)

    const [ groupedSources, setGroupedSources] = useState({})

    const [ sourceDataListSwitchSourceSelected, setSourceDataListSwitchSourceSelected ] = useState<any[]>()

    const _GetSourcesAPI = () => 
        GetAPI({ 
            apiName:"Sources",  
            serverManagerInformation 
        })
    
    useEffect(() => {
        fetchSourceList()
        fetchActiveSourceList()
    }, [])
    
    const fetchSourceList = async () => {
        try {
            const api = _GetSourcesAPI()
            const response = await api.ListSources()
            const sourceList = response.data
            setSourceList(sourceList)
            setGroupedSources(GroupSources(sourceList))
            setIsLoading(false)

        }catch(e){
            console.log(e)
        }
    }

    const fetchActiveSourceList = async () => {
        try {
            const api = _GetSourcesAPI()
            const response = await api.ListActiveSources()
            const activeSourceList = response.data
            setActiveSourceList(activeSourceList)
        }catch(e){
            console.log(e)
        }
    }
    
    const handleOpenSwitchSource = (repositoryNamespace) => {
        const sourceListFilteredByRepositoryNamespace = sourceList
        .filter((sourceData) => sourceData.repositoryNamespace === repositoryNamespace)
        setSourceDataListSwitchSourceSelected(sourceListFilteredByRepositoryNamespace)
    }

    const handleCloseSwitchSource = () => setSourceDataListSwitchSourceSelected(undefined)

    return <>
                <Menu style={{margin:"1em", "backgroundColor": "honeydew"}} >
                    <MenuMenu position='right'>
                        <MenuItem>
                            <Button icon primary>
                                add new repository namespace 
                            </Button>
                        </MenuItem>
                    </MenuMenu>
                </Menu>
                <Segment style={{margin:"1em", "backgroundColor": "honeydew"}}>
                    {
                        isLoading 
                        ? <Loader active style={{margin: "50px"}}/>
                        :<div style={{ overflow: 'auto', height:"77vh", "padding":"10px" }}>
                            <CardGroup>
                            {
                                Object.keys(groupedSources)
                                .map((repositoryNamespace) =>
                                    <RepositorySourceCard
                                        serverManagerInformation={serverManagerInformation}
                                        onOpenSwitchSource={handleOpenSwitchSource}
                                        activeSourceList={activeSourceList}
                                        repositoryNamespace={repositoryNamespace}/>)
                            }
                            </CardGroup>
                            
                        </div>
                    }
                </Segment>
                {
                    sourceDataListSwitchSourceSelected 
                    && <SwitchSourceModal
						sourceList={sourceDataListSwitchSourceSelected}
					 	open={true}
					 	onClose={handleCloseSwitchSource}/>
                }
            </>
}

export default RepositorySourcesContainer